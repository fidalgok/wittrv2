import idb from 'idb';

//first thing is to create a database with the open method
//the callback function only gets called if the browser doesn't
//know about the database, or if the version is less than the
//version passed in the open method. Save the promise in a variable
//so you can add items to the database later on
const dbPromise = idb.open('test-db', 1, function(upgradeDb) {
  var keyValStore = upgradeDb.createObjectStore('keyval');
  //put items in the store with .put(item, key)
  keyValStore.put('you', 'hello');
}); //this returns a promise which resolves to the database

//if you want to read from the database you have to create
//a transaction
dbPromise.then(db => {
  //pass in the object store you want to use for the transaction
  //we created keyval earlier
  const tx = db.transaction('keyval');
  //call object store using the object store you want
  var keyValStore = tx.objectStore('keyval');
  //next you use the get method and pass the key you're interested in
  return keyValStore.get('hello');
  //it returns a promise which resolves to the value you're interested in

}).then(val => console.log(val));

//what if you want to add a value?

dbPromise.then(function(db){
  //when you open a transaction this time set the 
  //readwrite property
  var tx = db.transaction('keyval', 'readwrite');
  var keyValStore = tx.objectStore('keyval');
  keyValStore.put('penguin', 'favoriteAnimal');
  //this returns a promise
  return tx.complete;
  //returns a promise that resolves if it completes

}).then(function(){
  console.log('added favorite animal to keyval');
});

dbPromise.then(function(db) {
  // TODO: in the keyval store, set
  // "favoriteAnimal" to your favourite animal
  // eg "cat" or "dog"
});
