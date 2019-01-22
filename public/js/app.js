/* global Vue */

import ErrorMessage from './components/error-message.js';
import FitRoute from './components/fit-route.js';

const error = (message, category) => ({ message, category });

function onSuccess(message) {
  this.error = error(message, 'success');
}

function onWarning(message) {
  this.error = error(message, 'warning');
}

function onError(message) {
  this.error = error(message, 'danger');
}

new Vue({
  el: '#main',
  data: {
    error: {
      message: null,
      category: null
    }
  },
  methods: {
    onSuccess,
    onWarning,
    onError
  },
  components: {
    ErrorMessage,
    FitRoute
  }
});
