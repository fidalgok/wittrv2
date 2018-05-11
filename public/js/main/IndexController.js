import PostsView from './views/Posts';
import ToastsView from './views/Toasts';
import idb from 'idb';

export default function IndexController(container) {
  this._container = container;
  this._postsView = new PostsView(this._container);
  this._toastsView = new ToastsView(this._container);
  this._lostConnectionToast = null;
  this._openSocket();
  this._registerServiceWorker();
}

//register serviceworker
IndexController.prototype._registerServiceWorker = function() {
  var indexController;

  indexController = this;

  if (!navigator.serviceWorker) {
    return;
  }
  navigator.serviceWorker
    .register('./sw.js', { scope: '/' })
    .then(reg => {
      if (!navigator.serviceWorker.controller) return;
      let workerWaiting = reg.waiting;
      let workerActive = reg.active;
      let installingWorker = reg.installing;
      console.log(`--------------------------------------`);
      console.log(`--------------------------------------`);
      console.log(`waiting worker:`);
      console.log(workerWaiting);
      console.log(`--------------------------------------`);
      console.log(`--------------------------------------`);
      console.log(`active worker:`);
      console.log(workerActive);
      console.log(`--------------------------------------`);

      //if there's a worker already waiting let's update the user
      if (workerWaiting) {
        console.log(`there's a worker waiting`);
        indexController._updateReady(workerWaiting);
        return;
      }

      if (installingWorker) {
        console.log(`there's a worker installing`);
        indexController._trackInstalling(installingWorker);
        return;
      }

      reg.addEventListener('updatefound', () => {
        installingWorker = reg.installing;
        console.log(`--------------------------------------`);
        console.log(`update found:`);
        console.log(installingWorker);
        console.log(installingWorker.state);
        indexController._trackInstalling(installingWorker);
        return;
      });
    })

    .catch(err => console.log(err));

  navigator.serviceWorker.addEventListener('controllerchange', function() {
    //fires when the service worker controlling the page changes

    window.location.reload();
  });
};

IndexController.prototype._trackInstalling = function(installingWorker) {
  var indexController = this;
  installingWorker.addEventListener('statechange', () => {
    //state has changed see if it is installed
    console.log('state changed: ');
    console.log(installingWorker.state);
    if (installingWorker.state == 'installed') {
      console.log('calling update ready');
      indexController._updateReady(installingWorker);
    }
  });
};

IndexController.prototype._updateReady = function(worker) {
  var toast = this._toastsView.show('New version available', {
    buttons: ['refresh', 'dismiss']
  });

  toast.answer.then(answer => {
    if (answer != 'refresh') return;
    //let service worker know to skip waiting
    worker.postMessage({ refresh: true });
  });
};

// open a connection to the server for live updates
IndexController.prototype._openSocket = function() {
  var indexController = this;
  var latestPostDate = this._postsView.getLatestPostDate();

  // create a url pointing to /updates with the ws protocol
  var socketUrl = new URL('/updates', window.location);
  socketUrl.protocol = 'ws';

  if (latestPostDate) {
    socketUrl.search = 'since=' + latestPostDate.valueOf();
  }

  // this is a little hack for the settings page's tests,
  // it isn't needed for Wittr
  socketUrl.search += '&' + location.search.slice(1);

  var ws = new WebSocket(socketUrl.href);

  // add listeners
  ws.addEventListener('open', function() {
    if (indexController._lostConnectionToast) {
      indexController._lostConnectionToast.hide();
    }
  });

  ws.addEventListener('message', function(event) {
    requestAnimationFrame(function() {
      indexController._onSocketMessage(event.data);
    });
  });

  ws.addEventListener('close', function() {
    // tell the user
    if (!indexController._lostConnectionToast) {
      indexController._lostConnectionToast = indexController._toastsView.show(
        'Unable to connect. Retrying…'
      );
    }

    // try and reconnect in 5 seconds
    setTimeout(function() {
      indexController._openSocket();
    }, 5000);
  });
};

// called when the web socket sends message data
IndexController.prototype._onSocketMessage = function(data) {
  var messages = JSON.parse(data);
  this._postsView.addPosts(messages);
};
