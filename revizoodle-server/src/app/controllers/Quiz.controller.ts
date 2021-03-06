/*
 * Copyright Toulouse INP - inp@toulouse-inp.fr - 22/02/2022
 *
 * contributor(s) :
 * - Jean-François Parmentier (jean-francois.parmentier@toulouse-inp.fr)
 * - John Tranier (john.tranier@ticetime.com)
 *
 * This software is governed by the CeCILL-B license under French law and
 * abiding by the rules of distribution of free software.  You can  use,
 * modify and/ or redistribute the software under the terms of the CeCILL-B
 * license as circulated by CEA, CNRS and INRIA at the following URL
 * "http://www.cecill.info".
 *
 * As a counterpart to the access to the source code and  rights to copy,
 * modify and redistribute granted by the license, users are provided only
 * with a limited warranty  and the software's author,  the holder of the
 * economic rights,  and the successive licensors  have only  limited
 * liability.
 *
 * In this respect, the user's attention is drawn to the risks associated
 * with loading,  using,  modifying and/or developing or reproducing the
 * software by the user in light of its specific status of free software,
 * that may mean  that it is complicated to manipulate,  and  that  also
 * therefore means  that it is reserved for developers  and  experienced
 * professionals having in-depth computer knowledge. Users are therefore
 * encouraged to load and test the software's suitability as regards their
 * requirements in conditions enabling the security of their systems and/or
 * data to be ensured and,  more generally, to use and operate it in the
 * same conditions as regards security.
 *
 * The fact that you are presently reading this means that you have had
 * knowledge of the CeCILL-B license and that you accept its terms.
 */

/**
 * REST Controller for Quiz entity
 */
// TODO Think to move dedicated Learners actions to a dedicated controller
import * as AuthenticationService from '../services/AuthenticationService'
import * as express from "express"
import {Op} from 'sequelize'
import {Model} from '../models';
import {assertIsFound, assertIsOwner, assertLearnerIsRegisteredOnQuiz, errorHandler,} from './ControllerUtil'
import Quiz from "../models/Quiz.model"
import Training from "../models/Training.model"

/**
 * Private methode for creating a new Training on a Quiz for a Learner.
 * @param quiz
 * @param learnerUuid
 * @return {*}
 */
const createEmptyTrainingForQuiz = (quiz: Quiz, learnerUuid: string): Promise<Training> => {
  const questions = JSON.parse(quiz.questions);

  // TODO type the question
  const createEmptyLearnerAnswer = function (question: any) {
    return {
      submitted: false, // TODO replace by score ?
      nbChoice: question.answers.length,
      choices: question.answers.map(() => false),
    };
  };

  return Model.Training.create({
    quizId: quiz.id,
    'learnerUuid': learnerUuid,
    score: null,
    answers: JSON.stringify(
      questions.map(createEmptyLearnerAnswer),
    ),
  });
};

/**
 * Private method for getting the last training of a Learner on a Quiz, or
 * creating the 1st one on the fly if there is none.
 * @param quiz
 * @param learnerUuid
 * @return {Promise<{quiz, lastTraining}>}
 */
const getOrCreateLastTraining = (quiz: Quiz, learnerUuid: string): Promise<{ quiz: Quiz, lastTraining: Training }> => {
  return new Promise((resolve, reject) => {
    // Create training on the fly if needed
    if (quiz['trainings'].length > 0) {
      resolve({
        quiz,
        lastTraining: quiz['trainings'][0],
      });
    }
    else {
      createEmptyTrainingForQuiz(quiz, learnerUuid).then(lastTraining => resolve({
        quiz,
        lastTraining,
      })).catch(reject);
    }
  });
};

/**
 * Get a Quiz
 * The logged user must be the owner of the quiz
 * URL : GET /api/quiz/:quizId
 */
exports.get = (req: express.Request, res: express.Response) => {
  const id = req.params.id || -1;

  Model.Quiz.findByPk(id, {raw: true})
    .then(assertIsFound(`There is no quiz with id ${id}`))
    .then(
      assertIsOwner(
        req,
        (quiz) => {
          return quiz!.teacherUuid;
        },
        `You are not the owner of the quiz ${id}`,
      ))
    .then(quiz => {
      // Parse the JSON representation of questions
      const parsedQuiz = {
        ...quiz,
        questions: JSON.parse(quiz!.questions),
      };
      res.json(parsedQuiz);
    })
    .catch(
      errorHandler(
        res,
        `Some error occurred while retrieving the quiz id=${id}`,
      ),
    );
};

/**
 * Get a Quiz associated with info about the last training of the logged
 * Learner on that Quiz
 * The 1st Training will be created on the fly if there is no training for the
 * learner
 * URL : GET /api/quiz/:id/latest-training
 */
exports.getWithLatestTraining = (req: express.Request, res: express.Response) => {
  const id = req.params.id || -1;
  const learnerUuid = AuthenticationService.getUUID(req);

  Model.Quiz.findByPk(id, {
    include: [
      {
        model: Model.Training,
        as: 'trainings',
        where: {
          learnerUuid: learnerUuid,
        },
        limit: 1,
        required: false,
        order: [['updatedAt', 'desc']],
      }],

  })
    .then(assertIsFound(`There is no quiz with id ${id}`))
    .then(
      quiz => getOrCreateLastTraining(quiz!, learnerUuid))
    .then(data => {
      const quiz = data.quiz;
      const lastTraining = data.lastTraining;
      const questions = JSON.parse(quiz.questions);
      const learnerAnswers = JSON.parse(lastTraining.answers);

      res.json({
        id: quiz.id,
        name: quiz.name,
        trainingId: lastTraining.id,
        questions,
        learnerAnswers,
      });

    })
    .catch(errorHandler(res));
};

/**
 * List all the quizzes of a Teacher
 * URL : GET /api/quiz
 * @return List<QuizSummary> as JSON
 */
exports.list = (req: express.Request, res: express.Response) => {

  Model.Quiz.findAll({
    where: {
      'teacherUuid': AuthenticationService.getUUID(req),
    },
  }).then(data => res.json(data.map(QuizSummary))).catch(errorHandler(res));
};

/**
 * Action to start a new Training on a Quiz for a Learner
 * URL: POST /api/quiz/:quizId/redo-training
 */
exports.redoTraining = (req: express.Request, res: express.Response) => {
  const quizId = req.params.id || -1;
  const learnerUuid = AuthenticationService.getUUID(req);

  Model.Quiz.findByPk(quizId)
    .then(assertIsFound<Quiz>(`There is no quiz with id ${quizId}`))
    .then(assertLearnerIsRegisteredOnQuiz(learnerUuid))
    .then((quiz) => createEmptyTrainingForQuiz(quiz, learnerUuid))
    .then((training) => res.json(training))
    .catch(errorHandler(res));
};

/**
 * Render the results on a Quiz as a ResultsSummary as JSON
 * URL : GET /api/quiz/:id/results
 */
exports.getResults = (req: express.Request, res: express.Response) => {
  const quizId = req.params.id || -1;

  Promise.all([
    Model.Quiz.findByPk(quizId, {
      attributes: ['id', 'name', 'nbQuestions', 'teacherUuid'],
    })
      .then(assertIsFound<Quiz>(`There is no quiz with id ${quizId}`))
      .then(assertIsOwner<Quiz>(
        req,
        (quiz) => quiz.teacherUuid,
        `You are not the owner of the quiz ${quizId}`,
      )),
    Model.Training.findAll({
      where: {
        quizId: quizId,
        score: {[Op.ne]: null},
      },
      include: {
        model: Model.Quiz,
        attributes: ['name'],
      },
      order: [
        ['id', 'ASC'],
      ],
    })

  ]).then(([quiz, trainingList]) => {
    //const [quiz, trainingList] = data;

    res.json(ResultsSummary(quiz, trainingList));
  }).catch(errorHandler(
      res,
      `Some error occurred while retrieving the results of the quiz id=${quizId}`,
    ),
  );
};

/**
 * A QuizSummary contains the main info of a Quiz but not the questions
 * @param quiz
 * @return {{nbQuestions, date, name, id}}
 * @constructor
 */
const QuizSummary = (quiz: Quiz) => {
  return {
    id: quiz['id'],
    name: quiz['name'],
    nbQuestions: quiz['nbQuestions'],
    date: quiz['updatedAt'],
  };
};

/**
 * Build the results data for a Quiz
 * @param quiz
 * @param trainingList
 * @constructor
 */
const ResultsSummary = function (quiz: Quiz, trainingList: Training[]) {
  const nbAttempts = trainingList.length;
  const learners = new Set();
  let data1stAttempt: Array<any> = Array.from({length: quiz.nbQuestions},
    () => []);

  trainingList.forEach(training => {
    if (!learners.has(training['learnerUuid'])) {
      learners.add(training['learnerUuid']);

      const currentTrainingAnswers = JSON.parse(training['answers']);
      // TODO Create answer type
      currentTrainingAnswers.forEach((value: any, index: number) => {
        data1stAttempt[index].push(value['score']);
      });
    }
  });
  const nbLearners = learners.size;

  return {
    quizId: quiz.id,
    quizName: quiz.name,
    nbAttempts,
    nbLearners,
    results1stAttempt: data1stAttempt.map(computeMean),
  };
};

/**
 * Compute the mean of an array of scores obtained by learners on a question
 * @param questionScoreList
 * @return {number}
 */
const computeMean = function (questionScoreList: number[]): number {
  return Math.round(
    questionScoreList.reduce((a, b) => {
      return a + b;
    }, 0) / questionScoreList.length,
  );
};