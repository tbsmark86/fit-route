function onFilesChange(files) {
  this.file = files[0];
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
    file: null
  }),
  methods: {
    onFilesChange,
    onCancel,
    onSubmit
  }
};

export default FileUpload;
