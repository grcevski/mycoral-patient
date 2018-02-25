import { AsyncStorage } from 'react-native';
import { STORE_KEY } from './constants';

//TODO: Replace this with local device storage lookup

const getIPFSProvider = () => {
  return { protocol:'http', address:'localhost', port:'5001' };
}

const records = () => {
  let p = new Promise(async function(resolve, reject) {
    try {
      let response = await AsyncStorage.getItem(`${STORE_KEY}.records`); 
      let result = await JSON.parse(response) || [];
      resolve(result);
    } catch (e) {
      reject(`Error retrieving records from async storage (${e})`);
    }
  });

  return p;
}

const addRecord = (data) => {
  let p = new Promise(function(resolve, reject) {
    try {
      records()
        .then(async (records) => {
          let newRecords = [...records, data];
          await AsyncStorage.setItem(`${STORE_KEY}.records`, JSON.stringify(newRecords));
          resolve(newRecords);
        })
    } catch (e) {
      reject(`Error adding records to async storage (${e})`);
    }
  });

  return p;
}

const removeRecord = (r) => {
  let p = new Promise(function(resolve, reject) {
    try {
      records()
        .then (async (records) => {
          let newRecords = records.filter((record) => (record.id !== r.id));
          await AsyncStorage.setItem(`${STORE_KEY}.records`, JSON.stringify(newRecords));
          resolve(newRecords);
        })
    } catch (e) {
      reject(`Error adding records to async storage (${e})`);
    }
  });

  return p;
}

module.exports = {
  records,
  addRecord,
  removeRecord,
  getIPFSProvider
}