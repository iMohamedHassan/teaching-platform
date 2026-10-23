class AppError extends Error {
  constructor(status, message, code, errors) {
    super(message);
    this.status = status;
    this.code = code;
    this.errors = errors;
    this.isOperational = true;
  }
}
module.exports = AppError;
