const staticCache = 'wittr-static-v3';

self.addEventListener('install', event => {
  const urlsToCache = [
    '/',
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
          .filter(key => key.startsWith('wittr-') && key != staticCache)
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
  event.respondWith(
    caches
      .match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })

      .catch(err => {
        return new Response('Uh oh, that totally failed: ' + err);
      })
  );
});
