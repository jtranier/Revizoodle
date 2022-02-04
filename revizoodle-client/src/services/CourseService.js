import http from '../http-commons';

class CourseService {

  get(courseId) {
    return http.get(`/course/${courseId}`);
  }

  findAllMyCourse() { // for teacher
    return http.get(`/course`);
  }

  create(name) {
    const formData = new FormData();
    formData.append('name', name);
    return http.post('/course', formData).then(res => {
      return res.data;
    }).catch(error => {
      console.error(error);
    });
  }

  addQuiz(courseId, quizId) {
    // TODO It would be nicer to pass data by a JSON body instead of FormData
    const formData = new FormData();
    formData.append('quizId', quizId);
    return http.post(`/course/${courseId}/add-quiz`, formData).then(() => {
      return {
        success: true,
      };
    }).catch(error => {
      console.error(error);
    });
  }

  register(courseId) {
    return new Promise((resolve, reject) => {
      http.post(`/course/${courseId}/register`).then(response => {
        if(!response.data.success) {
          throw response.data
        }

        resolve();
      }).catch(error => {
        reject(error);
      });
    });
  }
}

export default new CourseService();