import FileUpload from './file-upload.js';

function onFileUpload(gpxFile) {
  this.gpxFile = gpxFile;
  this.$emit('success', `Selected file ${gpxFile.name} (${gpxFile.size} bytes)`);
}

const FitRoute = {
  template: '#fit-route-template',
  data: () => ({
    gpxFile: null
  }),
  methods: {
    onFileUpload
  },
  components: {
    FileUpload
  }
};

export default FitRoute;
