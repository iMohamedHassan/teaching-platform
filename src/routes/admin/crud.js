const express = require('express');
const AppError = require('../../utils/AppError');
const catchAsync = require('../../utils/catchAsync');
const audit = require('../../utils/audit');
const { escapeRegex } = require('../../utils/helpers');
const { requirePerm, teacherScope } = require('../../middleware/auth');
const { validate, idParam } = require('../../middleware/validate');
const { sensitiveLimiter } = require('../../middleware/security');

// مصنع CRUD: بيعمل list/create/update/delete مع صلاحيات + نطاق المدرس + تسجيل في Audit Log
module.exports = function crud({ Model, entity, createSchema, perms, populate = [], searchFields = [], filters = [], sort = { createdAt: -1 }, resolve, beforeDelete }) {
  const router = express.Router();
  router.param('id', idParam);
  const updateSchema = createSchema.partial();

  const findScoped = async (req) => {
    const doc = await Model.findOne({ _id: req.params.id, ...teacherScope(req.user) });
    if (!doc) throw new AppError(404, 'العنصر غير موجود', 'NOT_FOUND');
    return doc;
  };
  const label = (d) => d.title || d.name;

  router.get('/', requirePerm(perms.read), catchAsync(async (req, res) => {
    const q = {};
    for (const f of filters) {
      const v = req.query[f];
      if (typeof v === 'string' && /^[\w-]+$/.test(v)) q[f] = v;
    }
    Object.assign(q, teacherScope(req.user)); // المدرس مايقدرش يطلب محتوى غيره
    if (typeof req.query.q === 'string' && req.query.q.trim() && searchFields.length) {
      const re = new RegExp(escapeRegex(req.query.q.trim()), 'i');
      q.$or = searchFields.map((f) => ({ [f]: re }));
    }
    let query = Model.find(q).sort(sort).limit(500);
    for (const p of populate) query = query.populate(p);
    res.json({ status: 'ok', items: await query.lean() });
  }));

  router.post('/', requirePerm(perms.write), validate(createSchema), catchAsync(async (req, res) => {
    const doc = await Model.create(await resolve(req, req.body, null));
    audit(req, 'create', entity, doc._id, { title: label(doc) });
    res.status(201).json({ status: 'ok', item: doc });
  }));

  router.patch('/:id', requirePerm(perms.write), validate(updateSchema), catchAsync(async (req, res) => {
    const doc = await findScoped(req);
    doc.set(await resolve(req, req.body, doc));
    await doc.save();
    audit(req, 'update', entity, doc._id, { title: label(doc), fields: Object.keys(req.body) });
    res.json({ status: 'ok', item: doc });
  }));

  router.delete('/:id', requirePerm(perms.del), sensitiveLimiter, catchAsync(async (req, res) => {
    const doc = await findScoped(req);
    if (beforeDelete) await beforeDelete(doc, req);
    await doc.deleteOne();
    audit(req, 'delete', entity, doc._id, { title: label(doc) });
    res.json({ status: 'ok' });
  }));

  return router;
};
