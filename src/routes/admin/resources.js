const { z } = require('zod');
const crud = require('./crud');
const Teacher = require('../../models/Teacher');
const Course = require('../../models/Course');
const Lecture = require('../../models/Lecture');
const Homework = require('../../models/Homework');
const Package = require('../../models/Package');
const Subscription = require('../../models/Subscription');
const AppError = require('../../utils/AppError');
const { oid } = require('../../utils/schemas');
const { parseYouTubeId } = require('../../utils/helpers');
const { teacherScope } = require('../../middleware/auth');
const { GRADE_KEYS } = require('../../config');

const grade = z.enum(GRADE_KEYS, { errorMap: () => ({ message: 'اختار السنة الدراسية' }) });
const text = (max) => z.string().trim().max(max).nullish();
const bool = z.boolean().optional();
const order = z.coerce.number().int().min(0).max(9999).optional();
const bad = (msg) => new AppError(400, msg, 'VALIDATION');

// المدرس/المساعد: المدرس بتاعه تلقائي. السوبر أدمن: لازم يختار مدرس.
async function teacherFor(req, bodyTeacher) {
  if (req.user.role !== 'super_admin') return teacherScope(req.user).teacher;
  if (!bodyTeacher) throw bad('اختار المدرس');
  if (!(await Teacher.exists({ _id: bodyTeacher }))) throw bad('المدرس غير موجود');
  return bodyTeacher;
}
async function courseFor(req, courseId) {
  const c = courseId && await Course.findOne({ _id: courseId, ...teacherScope(req.user) });
  if (!c) throw bad('الكورس غير موجود أو مش تابع ليك');
  return c;
}

// ---------- الكورسات (مجلدات المحاضرات) ----------
const courses = crud({
  Model: Course, entity: 'course',
  createSchema: z.object({
    teacher: oid.optional(), grade,
    title: z.string().trim().min(2, 'اكتب عنوان الكورس').max(120),
    description: text(1000), order, isPublished: bool,
  }),
  perms: { read: 'content:read', write: 'content:write', del: 'content:delete' },
  populate: [{ path: 'teacher', select: 'name' }],
  filters: ['teacher', 'grade'], searchFields: ['title'], sort: { grade: 1, order: 1, createdAt: -1 },
  resolve: async (req, body, existing) => {
    const data = { ...body };
    if (existing) delete data.teacher; // المدرس مابيتغيرش بعد الإنشاء
    else data.teacher = await teacherFor(req, body.teacher);
    return data;
  },
  beforeDelete: async (doc) => {
    await Promise.all([
      Lecture.deleteMany({ course: doc._id }),
      Homework.deleteMany({ course: doc._id }),
      Package.updateMany({ courses: doc._id }, { $pull: { courses: doc._id } }),
    ]);
  },
});

// ---------- المحاضرات ----------
const lectures = crud({
  Model: Lecture, entity: 'lecture',
  createSchema: z.object({
    course: oid,
    title: z.string().trim().min(2, 'اكتب عنوان المحاضرة').max(150),
    description: text(2000),
    videoUrl: z.string().trim().min(1, 'حط رابط فيديو يوتيوب').max(300),
    durationMin: z.coerce.number().int().min(0).max(1000).nullish(),
    order, isFree: bool, isPublished: bool,
  }),
  perms: { read: 'content:read', write: 'content:write', del: 'content:delete' },
  populate: [{ path: 'course', select: 'title grade' }, { path: 'teacher', select: 'name' }],
  filters: ['course', 'teacher'], searchFields: ['title'], sort: { course: 1, order: 1, createdAt: 1 },
  resolve: async (req, body, existing) => {
    const data = { ...body };
    const course = await courseFor(req, body.course || existing?.course);
    data.course = course._id;
    data.teacher = course.teacher;
    if (body.videoUrl !== undefined) {
      const id = parseYouTubeId(body.videoUrl);
      if (!id) throw bad('رابط يوتيوب غير صحيح');
      data.youtubeId = id;
    }
    delete data.videoUrl;
    return data;
  },
  beforeDelete: (doc) => Homework.updateMany({ lecture: doc._id }, { $set: { lecture: null } }),
});

// ---------- الواجبات ----------
const homework = crud({
  Model: Homework, entity: 'homework',
  createSchema: z.object({
    course: oid, lecture: oid.nullish(),
    title: z.string().trim().min(2, 'اكتب عنوان الواجب').max(150),
    description: text(3000),
    fileUrl: z.string().trim().url('رابط الملف غير صحيح').max(500).refine((u) => /^https:\/\//.test(u), 'لازم الرابط يبدأ بـ https').nullish(),
    dueDate: z.coerce.date().nullish(),
    isPublished: bool,
  }),
  perms: { read: 'content:read', write: 'content:write', del: 'content:delete' },
  populate: [{ path: 'course', select: 'title' }, { path: 'teacher', select: 'name' }, { path: 'lecture', select: 'title' }],
  filters: ['course', 'teacher'], searchFields: ['title'], sort: { dueDate: -1, createdAt: -1 },
  resolve: async (req, body, existing) => {
    const data = { ...body };
    const course = await courseFor(req, body.course || existing?.course);
    data.course = course._id;
    data.teacher = course.teacher;
    const lectureId = body.lecture !== undefined ? body.lecture : existing?.lecture;
    if (lectureId && !(await Lecture.exists({ _id: lectureId, course: course._id }))) throw bad('المحاضرة مش تابعة للكورس ده');
    data.lecture = lectureId || null;
    return data;
  },
});

// ---------- الباقات (السوبر أدمن بس هو اللي بيعدّل الأسعار) ----------
const packages = crud({
  Model: Package, entity: 'package',
  createSchema: z.object({
    teacher: oid.optional(), grade,
    title: z.string().trim().min(2, 'اكتب اسم الباقة').max(120),
    description: text(1500),
    price: z.coerce.number({ invalid_type_error: 'اكتب السعر' }).min(0).max(1000000),
    durationDays: z.coerce.number().int().min(1).max(3650).nullish(),
    courses: z.array(oid).max(100).optional(),
    isActive: bool, order,
  }),
  perms: { read: 'packages:read', write: 'packages:write', del: 'packages:write' },
  populate: [{ path: 'teacher', select: 'name' }, { path: 'courses', select: 'title' }],
  filters: ['teacher', 'grade'], searchFields: ['title'], sort: { grade: 1, order: 1, price: 1 },
  resolve: async (req, body, existing) => {
    const data = { ...body };
    let teacherId;
    if (existing) { delete data.teacher; teacherId = existing.teacher; }
    else { teacherId = await teacherFor(req, body.teacher); data.teacher = teacherId; }

    const g = body.grade || existing?.grade;
    const ids = [...new Set((body.courses ?? existing?.courses ?? []).map(String))];
    if (body.courses !== undefined || body.grade !== undefined) {
      const found = await Course.countDocuments({ _id: { $in: ids }, teacher: teacherId, grade: g });
      if (found !== ids.length) throw bad('في كورسات مش تابعة للمدرس ده أو مش من نفس السنة');
    }
    if (body.courses !== undefined) data.courses = ids;
    return data;
  },
  beforeDelete: async (doc) => {
    if (await Subscription.exists({ package: doc._id })) {
      throw new AppError(409, 'فيه طلاب مشتركين في الباقة دي. عطّلها بدل ما تحذفها.', 'IN_USE');
    }
  },
});

module.exports = { courses, lectures, homework, packages };
