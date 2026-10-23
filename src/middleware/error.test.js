const assert = require('node:assert/strict');
const { errorHandler } = require('./error');

const makeRes = () => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
};

const cases = [
  [{ phone: 1 }, { phone: '0999999999' }, 'رقم الموبايل مستخدم بالفعل'],
  [{ slug: 1 }, { slug: 'mohamed-saad' }, 'الرابط (slug) مستخدم بالفعل'],
  [{ customField: 1 }, { customField: 'abc' }, 'هذا الحقل مستخدم بالفعل'],
];

for (const [keyPattern, keyValue, expected] of cases) {
  const res = makeRes();
  errorHandler({ code: 11000, keyPattern, keyValue }, {}, res, () => {});
  assert.equal(res.body.message, expected, `expected "${expected}" but got "${res.body.message}"`);
}

console.log('error middleware duplicate tests passed');
