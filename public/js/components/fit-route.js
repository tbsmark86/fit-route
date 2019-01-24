import { parseGpx } from '../gpx.js';
import FileUpload from './file-upload.js';
import RouteMap from './route-map.js';

async function onFileUpload(gpxFile) {
  try {
    this.gpxFile = gpxFile;
    this.route = await parseGpx(gpxFile);
  }
  catch (error) {
    this.$emit('error', `Unable to process "${gpxFile.name}"`);
  }
}

const FitRoute = {
  template: '#fit-route-template',
  data: () => ({
    gpxFile: null,
    route: null
  }),
  methods: {
    onFileUpload
  },
  components: {
    FileUpload,
    RouteMap
  }
};

export default FitRoute;
