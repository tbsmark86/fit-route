/* global Vue */

const ErrorMessage = {
  template: '#error-message-template',
  props: {
    message: String
  }
};

const FitRoute = {
  template: '#empty-template',
};

new Vue({
  el: '#main',
  data: {
    showInfo: true,
    error: 'This application requires a browser supporting ES modules'
  },
  methods: {
    onShowInfo: () => undefined,
    onError: () => undefined
  },
  components: {
    ErrorMessage,
    FitRoute
  }
});
