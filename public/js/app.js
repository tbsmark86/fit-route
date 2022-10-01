/* global Vue */

import ErrorMessage from './components/error-message.js';
import FitRoute from './components/fit-route.js';

function onShowInfo(value) {
  this.showInfo = value;
}

function onError(message) {
  this.error = message;
}

const { createApp } = Vue;

const app = createApp({
  data: () => ({
    showInfo: true,
    error: null
  }),
  methods: {
    onShowInfo,
    onError
  },
  components: {
    ErrorMessage,
    FitRoute
  }
});

app.config.compilerOptions.whitespace = 'condense';
app.mount('#main');
