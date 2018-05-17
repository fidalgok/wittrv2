import PostsView from './views/Posts';
import ToastsView from './views/Toasts';
import idb from 'idb';

function openDatabase() {
  //if the browser doesn't support service worker
  //we don't care about having a database
  if (!navigator.serviceWorker) return Promise.resolve();

  //TODO return a promise for a db called wittr
  //object store name 'witters'
  //id as key
  //index called by-date sorted by time

  return idb.open('wittr', 1, function(upgradeDb) {
    switch (upgradeDb.oldVersion) {
      case 0:
        const witterStore = upgradeDb.createObjectStore('wittrs', {
          keyPath: 'id'
        });

        witterStore.createIndex('by-date', 'time');
    }
  });
}

export default function IndexController(container) {
  this._container = container;
  this._postsView = new PostsView(this._container);
  this._toastsView = new ToastsView(this._container);
  this._lostConnectionToast = null;
  this._dbPromise = openDatabase();
  this._registerServiceWorker();
  this._cleanImageCache();
  var indexController = this;
  setInterval(function() {
    indexController._cleanImageCache();
  }, 1000 * 60 * 5);
  this._showCachedMessages().then(function() {
    indexController._openSocket();
  });
}

IndexController.prototype._cleanImageCache = function() {
  this._dbPromise
    .then(db => {
      //TODO: open the wittr object store get all messages and get photo urls
      const tx = db.transaction('wittrs');
      const wittrStore = tx.objectStore('wittrs');
      return wittrStore.getAll();
    })
    .then(messages => {
      const photos = [];
      messages.forEach(message => {
        if(message.photo){
          photos.push(message.photo);
        }
        photos.push(message.avatar);
      });
        

      caches.open('wittr-content-imgs').then(cache => {
        cache.keys().then(keys => {
          keys.forEach(key => {
            var keyUrl = new URL(key.url);
            if (!photos.includes(keyUrl.pathname)) {
              cache.delete(key);
            }
          });
        });
      });
    });
};

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
  this._dbPromise
    .then(db => {
      if (!db) return;

      //TODO: put each message into the wittrs object store
      const tx = db.transaction('wittrs', 'readwrite');
      const wittrStore = tx.objectStore('wittrs');
      messages.forEach(message => wittrStore.put(message));

      //TODO: keep only the 30 newest entries in wittrs but delete the rest
      const dateIndex = wittrStore.index('by-date');
      return (
        dateIndex
          .openCursor(null, 'prev')
          .then(cursor => {
            return cursor.advance(30);
            /**
             * My version of the code, it works but is super ugly
             */
            // console.log('added messages to wittrstore');
            // var count = 0;
            // console.log('first time cursoring', ++count);
            // function iterateCursor(cursor) {
            //   if (!cursor) return;
            //   count++;
            //   console.log('recursively cursoring at: ', count);
            //   if (count < 28) {
            //     count = 28;
            //     cursor.advance(29).then(iterateCursor);
            //   } else {
            //     console.log('cursored at: ', cursor.value);
            //     //we are past the latest 30 entries so delete items
            //     cursor.delete();
            //     return cursor.continue().then(iterateCursor);
            //   }
            // }
            // return cursor.continue().then(iterateCursor);
          })
          //adding a then after cursoring past the first 30 posts
          .then(function iterateCursor(cursor) {
            //we want to delete everything from here on
            if (!cursor) return;
            cursor.delete();
            return cursor.continue().then(iterateCursor);
          })
      );
    })
    .then(() => console.log('added messages to database'));
  this._postsView.addPosts(messages);
};

IndexController.prototype._showCachedMessages = function() {
  var indexController = this;

  return this._dbPromise
    .then(db => {
      //if already showing posts or very first load
      //no point fetching posts from db
      if (!db || indexController._postsView.showingPosts()) return;

      //TODO: get all of the wittr message objects from indexeddb,
      //then pass them to: indexControllwer._postsView.addPosts(messages)
      //in order of date, starting with the latest, return a promise
      //that does all this, so the websocket won't be opened until done
      const tx = db.transaction('wittrs');
      const wittrsStore = tx.objectStore('wittrs');
      const dateIndex = wittrsStore.index('by-date');

      return dateIndex.getAll();
    })
    .then(messages => {
      if (messages) {
        messages.sort((a, b) => new Date(b.time) - new Date(a.time));
        //console.log(messages);
        indexController._postsView.addPosts(messages);
      }
      return;
    });
};
