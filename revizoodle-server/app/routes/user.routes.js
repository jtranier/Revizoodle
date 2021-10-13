module.exports = app => {
  const userController = require('../controllers/user.controller');

  let router = require('express').Router();

  router.get('/is-teacher', userController.isTeacher);
  router.post('/request-teacher-access', userController.requestTeacherAccess);

  app.use('/api/user/', router);
}