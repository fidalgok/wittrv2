const staticCache = 'wittr-static-v4';
const contentImgsCache = 'wittr-content-imgs';
const allCaches = [staticCache, contentImgsCache];

self.addEventListener('install', event => {
  const urlsToCache = [
    '/skeleton',
    'js/main.js',
    'css/main.css',
    'imgs/icon.png',
    'https://fonts.gstatic.com/s/roboto/v15/2UX7WLTfW3W8TclTUvlFyQ.woff',
    'https://fonts.gstatic.com/s/roboto/v15/d-6IYplOFocCacKzxwXSOD8E0i7KZn-EPnyo3HZu7kw.woff'
  ];
  event.waitUntil(
    //add to cache named 'wittr-static-v1' urls from urlstocache
    caches.open(staticCache).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
});

//activate

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keylist => {
      return Promise.all(
        keylist
          .filter(key => key.startsWith('wittr-') && !allCaches.includes(key))
          .map(key => {
            return caches.delete(key);
          })
      );
    })
  );
});

//fetch

self.addEventListener('fetch', event => {
  // if (event.request.method != 'GET') return;
  // if (event.request.url.match(/.jpg$/)) {
  //   event.respondWith(fetch('/imgs/dr-evil.gif'));
  // }
  var requestUrl = new URL(event.request.url);
  if (requestUrl.origin === location.origin) {
    if (requestUrl.pathname === '/') {
      event.respondWith(
        caches.match('/skeleton').then(response => {
          return response;
        })
      );
    }
    // else {
    //   event.respondWith(
    //     caches
    //       .match(event.request)
    //       .then(response => response || fetch(event.request))
    //   );
    // }
    if (requestUrl.pathname.startsWith('/photos/')) {
      event.respondWith(servePhoto(event.request));
      return;
    }

    if (requestUrl.pathname.startsWith('/avatars/')) {
      event.respondWith(serveAvatar(event.request));
      return;
    }
  }
  //else {
  event.respondWith(
    caches
      .match(event.request)
      .then(response => {
        if (response) {
          console.log(response);
        }
        return response || fetch(event.request);
      })

      .catch(err => {
        return new Response('Uh oh, that totally failed: ' + err);
      })
  );
  //}
});

function servePhoto(request) {
  let storageUrl = request.url.replace(/-\d+px\.jpg$/, '');
  return caches.open(contentImgsCache).then(cache => {
    return cache.match(storageUrl).then(response => {
      const networkFetch = fetch(request).then(networkResponse => {
        cache.put(storageUrl, networkResponse.clone());
        return networkResponse;
      });
      return response || networkFetch;
    });
  });
}

function serveAvatar(request) {
  let storageUrl = request.url.replace(/-\d+x\.jpg$/, '');
  return caches.match(storageUrl).then(
    response =>
      response ||
      fetch(request).then(response => {
        return caches.open(contentImgsCache).then(cache => {
          cache.put(storageUrl, response.clone());
          return response;
        });
      })
  );
}

self.addEventListener('message', e => {
  if (e.data.refresh === true) {
    self.skipWaiting();
  }
});
