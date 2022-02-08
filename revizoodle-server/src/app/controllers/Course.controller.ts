/**
 * REST Controller for the Course entity
 */
import * as AuthenticationService from '../services/AuthenticationService'
import {Model} from '../models';

const {assertIsFound, errorHandler} =
  require('./ControllerUtil');

/**
 * Get a Course as JSON
 * URL: /api/course/:id
 * @return 404 if not found
 * @return 500 if an error occurs
 * @return 200 CourseSummary (JSON) if OK
 */
export const get = (req, res) => {
  const id = req.params.id || -1;

  Model.Course.findOne({
    where: {id},
    include: {
      model: Model.Quiz,
      order: [['updatedAt', 'desc']],
    },
  }).then(assertIsFound(`There is no course with id ${id}`)).then((course) => {
    res.json(CourseSummary(course));
  }).catch(errorHandler(res));
};

/**
 * List the course of the teacher initiating the query
 * URL: /api/course
 */
export const list = (req, res) => {
  Model.Course.findAll({
    order: [
      ['updatedAt', 'DESC'],
    ],
    where: {
      'teacherUuid': AuthenticationService.getUUID(req),
    },
  }).then(courseList => res.json(courseList)).catch(errorHandler(res));
};

/**
 * Create a course
 * URL: POST /api/course
 * The request body must contains a name attribute
 *
 * @return 500 if something gets wrong
 * @return 200 created Course (json) if OK
 */
export const create = (req, res) => {
  Model.Course.create({
    name: req.body.name, // TODO check validity
    teacherUuid: AuthenticationService.getUUID(req),
  }).then(course => res.json(course)).catch(errorHandler(res));
};

/**
 * Add a Quiz to a Course
 * URL: POST /api/course/:courseId/add-quiz
 * quizId must provided as form data
 *
 * @return 200 { success: true } if OK
 * @return 500 if an error occurs
 *
 * Implementation note : this is a very simple implementation without any
 * check ; a 500 error will be thrown if courseId or quizId are incorrect
 */
export const addQuiz = (req, res) => {
  const courseId = req.params.courseId;
  const quizId = req.body.quizId;

  Model.CourseQuiz.create({
    courseId: courseId,
    quizId: quizId,
  }).then(() => {
    return {success: true};
  }).catch(errorHandler(res));
};

/**
 * Register a Learner to a Course
 * URL : POST /api/course/:courseId/register
 */
export const register = (req, res) => {
  const courseId = req.params.courseId || -1;
  const learnerUuid = AuthenticationService.getUUID(req);

  Model.Course.findByPk(courseId, {
    include: {
      model: Model.CourseRegistration,
      where: {
        'learnerUuid': learnerUuid,
      },
      required: false,
    },
  }).then(assertIsFound(`There is no course with id ${courseId}`))
    .then((course) => {
      if (course['courseRegistrations'].length > 0) {
        // Already registered
        return;
      }

      return Model.CourseRegistration.create({
        'learnerUuid': learnerUuid,
        courseId: courseId,
      });
    })
    .then((_) => res.json({success: true}))
    .catch(errorHandler(res));
};

/**
 * The summary of a course that includes the main course properties,
 * and the list of quizzes summaries (id, name, last update and
 * number of questions in the quiz)
 * @param course a course entity from db (with quizzes fetched)
 * @returns {{quizList: *, name, updateAt, id}}
 * @constructor
 */
const CourseSummary = (course) => {
  return {
    id: course.id,
    name: course.name,
    updateAt: course.updateAt,
    quizList: course['quizzes'].map(quiz => {
      return {
        id: quiz.id,
        name: quiz.name,
        updatedAt: quiz['courseQuiz'].updatedAt,
        nbQuestions: quiz.nbQuestions,
      };
    }),
  };

};