/* global Vue */

const ErrorMessage = {
  template: '#error-message-template',
  props: {
    message: String
  },
  computed: {
    cssClass: () => ['alert', 'alert-danger']
  }
};

const FitRoute = {
  template: '#empty-template',
};

new Vue({
  el: '#main',
  data: {
    error: {
      message: 'This application requires a browser supporting ES modules'
    }
  },
  components: {
    ErrorMessage,
    FitRoute
  }
});
