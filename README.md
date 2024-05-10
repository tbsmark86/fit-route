Code for<br>
<https://tobis-page.de/fit-route/>


This a fork of https://gitlab.com/nwholloway/fit-route with custom extension.
Mainly manual adding of turn instructions - this part is in conflict with the original code.

FIT Route Converter
===================

This is a serverless solution to the problem of converting a GPX file for
an event into a FIT file that can be used directly by a Garmin Edge cycle
computer or compatible devices.

Development
-----------

Start a local server:

```console
$ npm install
$ npm start
```

The application will be served up on <http://localhost:8080/>.

Consistent code formatting is achieved using [Prettier](https://prettier.io/).

```console
$ npm run format
```

Notes
-----

This has been written using ES6 modules, and does not need a build step to
transpile for execution.  All 3rd party libraries are loaded from their CDNs.

All modern browsers work (Chrome, Firefox, Safari, Edge).  It would be possible
to transpile & polyfill to support other browsers.

Documentation of the FIT file format is contained in the FIT SDK
([download](https://www.thisisant.com/resources/fit/)), and this implementation
does the bare minimum required.

Third Party Libraries
---------------------

* [Vue.js](https://vuejs.org/)
* [Bootstrap](https://getbootstrap.com/)
* [Leaflet](https://leafletjs.com/)
* [Font Awesome](https://fontawesome.com/)
