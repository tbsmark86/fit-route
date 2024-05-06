import { getBool, setBoolWatchFunc } from '../localStorage.js';

function onFilesChange(files) {
  this.file = files[0];
  if (this.auto_submit) {
    this.onSubmit();
  }
}

function onCancel() {
  this.file = null;
}

function onSubmit() {
  this.$emit('submit', this.file);
}

const FileUpload = {
  template: '#file-upload-template',
  data: () => ({
    file: null,
    auto_submit: getBool('auto-submit', false)
  }),
  methods: {
    onFilesChange,
    onCancel,
    onSubmit
  },
  watch: {
    auto_submit: setBoolWatchFunc('auto-submit')
  }
};

export default FileUpload;
