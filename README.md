# Task Runner
Front-end tool for task automation.

## Dependencies
1. [NodeJS](http://nodejs.org/) v18+ 
2. [NPM](https://www.npmjs.com/)
3. [Google Autocomplete ]

- 

Please make sure to use npm package manager and Node.js v18+.

## Install
In the root directory of the project run:

```
npm install
```

This will install the required dependencies including `@mui/x-data-grid`.

To install additional dependencies such as `@mui/x-data-grid`:

## Development
To start the project in development mode, run:

```
npm run dev
```
npm install --save react-google-places-autocomplete

npm install firebase

npm install @mui/x-data-grid

npm install @mui/icons-material

npm install @mui/material @emotion/react @emotion/styled @mui/icons-material

npm install @hello-pangea/dnd

npm install uuid

npm install @tanstack/react-query

npm install @tanstack/react-query-persist-client @tanstack/query-sync-storage-persister

npm install @mui/lab

npm i xstate @xstate/react

npm install react-square-web-payments-sdk

npm install -g firebase-tools

npm install @xstate/react

npm install xstate @xstate/react ? I don't think this one loaded

npm install react-payment-logos

npm install @mui/material @emotion/react @emotion/styled @emotion/cache

npm install @mui/xcharts

npm install @mui/x-date-pickers date-fns @xstate/react xstate

## Build
To build the project for production, run:

```
npm run build

npm install --save react-google-places-autocomplete

```
npm install firebase

npm install @mui/x-data-grid

npm install @mui/icons-material


## Preview production files
To locally preview the production build run:

```
npm run preview
```

---

## How to viwew pages

You need to enter the page name in the address bar.

For example:

```
http://my-ip:8000/about.html
```

### Dev process
There is an `index.html` file that shows the contents of your dev env (i.e. a pretty server listing).

This file doesn't get built.

## How to load assets

### HTML assets

Assets loaded from build/assets where build is the root:

```
<img src="assets/images/my-image.png" alt="">
```

Loading vendor CSS or JS:

```
<link rel="stylesheet" href="/assets/vendor/my-style.css" type="text/css" media="all" />
<script type="text/javascript" src="/assets/vendor/my-script.js"></script>
```

### CSS assets

Fonts start from build with a slash (/):

```
url('/assets/fonts/my-font.woff') format('woff');
```

The path for CSS background images start from assets as well.

```
background: url(/assets/images/images/temp/logo.png) 0 0 no-repeat;
```

### AJAX assets

Use `./` in your local AJAX URLs.

```
<a href="./ajax/popup.html" class="js-popup">Popup</a>
```

---

Responsive mixin disclaimer:

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

======

### Missing fetures:

* Autoprefixer - note that there is no autoprefixer. You'll need to handle vendor prefixes yourself when needed.
