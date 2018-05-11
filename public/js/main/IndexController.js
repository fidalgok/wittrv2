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
IndexController.prototype._registerServiceWorker = () => {
  var indexController;
  console.log(this);
  indexController = this;
  console.log(indexController);

  if (!navigator.serviceWorker) {
    return;
  }
  navigator.serviceWorker
    .register('./sw.js', { scope: '/' })
    .then(reg => {
      let workerWaiting = reg.waiting;
      let workerActive = reg.active;

      console.log(`--------------------------------------`);
      console.log(`--------------------------------------`);
      console.log(`waiting worker:`);
      console.log(workerWaiting);
      console.log(`--------------------------------------`);
      console.log(`--------------------------------------`);
      console.log(`active worker:`);
      console.log(workerActive);
      console.log(`--------------------------------------`);

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        console.log(`--------------------------------------`);
        console.log(`installing worker:`);
        console.log(newWorker);
        console.log(newWorker.state);
        newWorker.addEventListener('statechange', () => {
          //state has changed see if it is installed
          console.log('state changed: ');
          console.log(newWorker.state);
          if (newWorker.state == 'installed') {
            console.log('calling update ready');
            indexController._updateReady();
          }
        });
      });

      //if there's a worker already waiting let's update the user
      if (workerWaiting) {
        console.log(`there's a worker waiting`);
        indexController._updateReady();
      }
    })

    .catch(err => console.log(err));
};

IndexController.prototype._updateReady = function() {
  var toast = this._toastsView.show('New version available', {
    buttons: ['whatever']
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
