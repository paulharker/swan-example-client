var fs              = require('fs');
var gulp            = require('gulp');
var runSequence     = require('run-sequence');
var changed         = require('gulp-changed');
var plumber         = require('gulp-plumber');
var to5             = require('gulp-babel');
var BuildConfig     = require('../BuildConfig');
var sourcemaps      = require('gulp-sourcemaps');
var paths           = require('../paths');
var compilerOptions = require('../babel-options');
var assign          = Object.assign || require('object.assign');
var notify          = require('gulp-notify');
var less            = require('gulp-less');
var outputScripts, outputStyles;

// transpiles changed es6 files to SystemJS format
// the plumber() call prevents 'pipe breaking' caused
// by errors from other gulp plugins
// https://www.npmjs.com/package/gulp-plumber
gulp.task('build-system', function() {
  return gulp.src(paths.source)
    .pipe(plumber({errorHandler: notify.onError('Error: <%= error.message %>')}))
    .pipe(changed(outputScripts, {extension: '.js'}))
    .pipe(sourcemaps.init({loadMaps: true}))
    .pipe(to5(assign({}, compilerOptions.system())))
    .pipe(sourcemaps.write({includeContent: false, sourceRoot: '/src'}))
    .pipe(gulp.dest(outputScripts));
});

// copies changed html files to the output directory
gulp.task('build-html', function() {
  return gulp.src(paths.html)
    .pipe(changed(outputScripts, {extension: '.html'}))
    .pipe(gulp.dest(outputScripts));
});

gulp.task('build-less', function() {
  return gulp.src(paths.less)
    .pipe(less({
      paths: ['node_modules']
    }))
    .pipe(gulp.dest(outputStyles));
});

gulp.task('copy-local', function(callback) {
  var deployedPath = paths.scriptRoot + 'config/deployed.js';
  var deployedTmp  = outputScripts + 'config/deployed.js';

  if (!process.env.CONTEXT) {
    fs.unlinkSync(deployedTmp);

    return callback();
  }

  var deployConfig = fs.readFileSync(paths.scriptRoot + 'config/deployed.js', 'utf8');
  var tmpLocal     = outputScripts + 'config/local.js';
  var buildConfig  = new BuildConfig;

  if (fs.existsSync(tmpLocal)) {
    fs.unlinkSync(tmpLocal);
  }

  buildConfig.getEndpoint(process.env.CONTEXT, process.env.HEAD).then(endpoint => {
    var environment = process.env.CONTEXT === 'production' ? 'production' : 'staging';
    deployConfig    = deployConfig.replace('{{environment}}', environment).replace(/\{\{apiUrl}}/g, endpoint);

    fs.writeFile(tmpLocal, deployConfig, error => {
      fs.unlinkSync(deployedTmp);

      if (error) {
        return callback(error);
      }

      callback();
    });
  }).catch(callback);
});

// this task calls the clean task (located
// in ./clean.js), then runs the build-system
// and build-html tasks in parallel
// https://www.npmjs.com/package/gulp-run-sequence
gulp.task('build', function(callback) {
  outputScripts = paths.devRoot + paths.scripts;
  outputStyles  = paths.devRoot + paths.styles;

  return runSequence(
    'clean-dev',
    'unbundle',
    ['build-system', 'build-html', 'build-less'],
    callback
  );
});

gulp.task('build-dist', function(callback) {
  outputScripts = paths.tmpRoot + paths.scripts;
  outputStyles  = paths.tmpRoot + paths.styles;

  return runSequence(
    ['clean-tmp', 'clean-dist'],
    ['build-system', 'build-html', 'build-less'],
    'copy-local',
    callback
  );
});
