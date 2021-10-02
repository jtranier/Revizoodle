module.exports = app => {
  const trainingController = require('../controllers/training.controller');

  let router = require('express').Router();
  router.put('/:id', trainingController.update);
  router.put('/:id/score', trainingController.updateScore);

  app.use('/api/learner/training/', router);
}