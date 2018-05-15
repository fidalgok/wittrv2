import idb from 'idb';

//first thing is to create a database with the open method
//the callback function only gets called if the browser doesn't
//know about the database, or if the version is less than the
//version passed in the open method. Save the promise in a variable
//so you can add items to the database later on
const dbPromise = idb.open('test-db', 6, function(upgradeDb) {
  //when upgrading a db you have to tell the browser which
  //object stores are already there using a switch statement
  //is an easy way to do this
  switch (upgradeDb.oldVersion) {
    case 0:
      var keyValStore = upgradeDb.createObjectStore('keyval');
      //put items in the store with .put(item, key)
      keyValStore.put('you', 'hello');
    //you don't want a break statement because you want the case to fall through
    //and complete additional statements
    case 1:
      //you can create multiple object stores in the open method. in order to change
      //the information after creation you have to change the version number above and
      //then you can use upgradeDb again
      upgradeDb.createObjectStore('people', { keyPath: 'name' });
    //keypath tells the databasestore which field should serve as the key.
    case 2: //it in the same way as when accessing it from the dbPromise //in indexing. upgradedb has its own transaction property so you can access //if you want to create an index, you have to get the store you're interested
    {
      const peopleStore = upgradeDb.transaction.objectStore('people');

      //now create an index passing the name to use and the keystore
      peopleStore.createIndex('animal', 'favoriteAnimal');
    }

    case 3:
      //create an index to sort people by age
      const peopleStore = upgradeDb.transaction.objectStore('people');
      peopleStore.createIndex('age', 'age');
  }
}); //idb.open returns a promise which resolves to the database so we caught it
//in a variable called dbPromise that we can use below to manipulate the database

//if you want to read from the database you have to create
//a transaction
dbPromise
  .then(db => {
    //pass in the object store you want to use for the transaction
    //we created keyval earlier
    const tx = db.transaction('keyval');
    //call object store using the object store you want
    var keyValStore = tx.objectStore('keyval');
    //next you use the get method and pass the key you're interested in
    return keyValStore.get('hello');
    //it returns a promise which resolves to the value you're interested in
  })
  .then(val => console.log(val));

//what if you want to add a value?

dbPromise
  .then(function(db) {
    //when you open a transaction this time set the
    //readwrite property
    var tx = db.transaction('keyval', 'readwrite');
    var keyValStore = tx.objectStore('keyval');
    keyValStore.put('penguin', 'favoriteAnimal');
    //this returns a promise
    return tx.complete;
    //returns a promise that resolves if it completes
  })
  .then(function() {
    console.log('added favorite animal to keyval');
  });

//put some stuff in the person store

dbPromise
  .then(db => {
    const tx = db.transaction('people', 'readwrite');
    const peopleStore = tx.objectStore('people');

    peopleStore.put({
      name: 'Kyle Fidalgo',
      age: 31,
      favoriteAnimal: 'Penguin'
    });

    peopleStore.put({
      name: 'Amy Fidalgo',
      age: 30,
      favoriteAnimal: 'cat'
    });

    peopleStore.put({
      name: 'Sean Fidalgo',
      age: 26,
      favoriteAnimal: 'dog'
    });

    peopleStore.put({
      name: 'Emma Fidalgo',
      age: 11,
      favoriteAnimal: 'dog'
    });

    return tx.complete;
  })
  .then(() => console.log('success adding person'));

//if you want to read the data use the getAll method on the store
dbPromise
  .then(db => {
    const tx = db.transaction('people');
    const peopleStore = tx.objectStore('people');
    //open the index you created in the upgradeDb callback
    const animalIndex = peopleStore.index('animal');
    //you can get all, or pass a parameter to only pull people that match that criteria
    //also by returning the index you sort the database on the index specified
    return animalIndex.getAll('dog');
  })
  .then(people => {
    people.forEach(person => console.log(person.favoriteAnimal));
  });

//log all people by age

// dbPromise
//   .then(db => {
//     const tx = db.transaction('people');
//     const peopleStore = tx.objectStore('people');

//     const ageIndex = peopleStore.index('age');

//     return ageIndex.getAll();
//   })
//   .then(people => console.log(people));

//log people using a cursor

dbPromise
  .then(db => {
    const tx = db.transaction('people');
    const peopleStore = tx.objectStore('people');

    const ageIndex = peopleStore.index('age');

    return ageIndex.openCursor();
  }) //you could also skip items by calling cursor .advance here
  /**
   * .then(cursor => {
   *  if(!cursor) return
   *  return cursor.advance(2); //skip two items
   * })
   */
  .then(function cursorIterate(cursor) {
    if (!cursor) return;
    console.log('Cursored at: ', cursor.value.name);
    //you can modify as you cursor through by using
    // cursor.update(newvalue)
    // or cursor.delete() to remove it
    return cursor.continue().then(cursorIterate);
  })
  .then(() => {
    console.log('done cursoring');
  });
