const AuthenticationService = require('../services/AuthenticationService');
module.exports = app => {
  const xmlController = require('../controllers/xml.controller');

  let router = require('express').Router();

  router.post('/upload', AuthenticationService.checkIsTeacher, xmlController.uploadMoodleXml)

  app.use('/api/xml/', router);
}