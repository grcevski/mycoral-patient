import React, { Component } from 'react';
import { View, ScrollView, Alert } from 'react-native';
import { Button } from 'react-native-elements';
import { List, ListItem } from 'react-native-elements';
import nextFrame from 'next-frame';
import { FileSystem } from 'expo';
import { connect } from 'react-redux';

import { CoralHeader, colors, MessageModal, MessageIndicator } from '../ui';
import store from '../utilities/store';
import { keysExist, publicKeyPEM } from '../utilities/pki';
import ipfs from '../utilities/expo-ipfs';
import importHelpers from '../utilities/import_helpers';

class SharedRecordsScreenUnwrapped extends Component {

  constructor(props) {
    super(props);

    this.notifiedWithRecords = [];

    this.state = { loading: true, mounted: false, modalVisible: false, contacts:[] };
  }

  async reloadRecords() {
    let contacts = await store.contacts();

    let sharedRecords = await store.sharedRecords();
    let externalRecords = await store.externalRecords();

    let contactsArray = importHelpers.groupByContact(contacts, sharedRecords, externalRecords);

    this.setState({ contacts: contactsArray, loading: false });
  }

  onShareKeyUploadFailed() {
    this.setState({ modalVisible: true, uploadError: true });
  }

  componentDidMount() {
    this.reloadRecords();
  }

  hideModal() {
    this.setState({ modalVisible: false });
  }

  onQRCodeScanned(type, data) {
    importHelpers.qrCodeRecordHelper(data)
      .then((scanned) => {
        const { record } = scanned;
        if (record) {
          this.reloadRecords();            
        } else {
          Alert.alert(
            'QR Code Scan Error',
            "The QR Code you just scanned doesn't look like valid Coral Health shared record. Please make sure you are scanning the QR code shown on the Shared Records screen of your contact.",
            [
              {text: 'OK', onPress: () => {} },
            ],
            { cancelable: true }
          );
        }
      });
  }

  /**
   * This function merges externally supplied state by reducers to what we hold as loaded from the store.
   * It's more complicated than it should be, but perhaps we can fix that when we refactor some of the store
   * code to go through corald. 
   *
   * The general idea is that we get events for removed and added records and we match them against what 
   * we have in state to clean-up or add new entries.
   */
  mergeContacts(local, updates) {
    let result = importHelpers.applySharedRecordUpdates(local, updates);

    // We don't se setState on purpose. This is just to update the state variable with the updates. The result will already
    // supply the correct array to the render method.
    this.state.contacts = result;
    return result;
  }

  render() {
    if (this.state.loading) {
      return (
        <View style={{ flex: 1, flexDirection: 'column', justifyContent: 'center', backgroundColor: colors.bg }}>
          <MessageIndicator message="Loading shared records..." />
        </View>
      );
    }

    if (this.state.creatingSharedKey) {
      return (
        <View style={{ flex: 1, flexDirection: 'column', justifyContent: 'center', backgroundColor: colors.bg }}>
          <MessageIndicator message="Creating your shared key..." />
        </View>
      );
    }

    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <CoralHeader title='Shared Medical Records' subtitle='You have shared your records with the people below.'/>
        <ScrollView style={{ flex: 1}}>
          <MessageModal
            visible={this.state.modalVisible}
            onClose={this.hideModal.bind(this)}
            error={this.state.uploadError}
            errorTitle='Error uploading to IPFS'
            title=''
            errorMessage='Please verify that you have internet connection and that your IPFS configuration is correct in Settings > Account.'
            message=''
            ionIcon='ios-medkit'
          />
          <List containerStyle={{marginTop: 0, marginBottom: 20, borderTopWidth: 0, borderBottomWidth: 0}}>
            {
              this.mergeContacts(this.state.contacts, this.props.updates).map((entry) => (
                <ListItem
                  containerStyle={{backgroundColor:(entry.contact.external) ? '#ddd' : 'white'}}
                  roundAvatar                  
                  avatar={{uri:entry.contact.picture}}
                  key={entry.contact.key}
                  title={entry.contact.nickname}
                  subtitle={(entry.contact.external) ? 'Imported Records' : null}
                  badge={{'value': `${entry.records.length} records`}}
                  chevronColor={colors.red}
                  onPress={() => this.props.navigation.navigate('SharedRecordsWith', 
                    {
                      contact: entry.contact,
                      records: entry.records,
                      onRecordsChanged: this.reloadRecords.bind(this)
                    })}
                />
              ))
            }
          </List>
        </ScrollView>
        <View style={{ paddingTop: 15}}>
          <Button
            backgroundColor={colors.gray}
            icon={{name: 'qrcode', type: 'font-awesome'}}
            title='Add Records From Others'
            onPress={() => this.props.navigation.navigate('QRCodeReader', {onQRCodeScanned: this.onQRCodeScanned.bind(this)})}
          />
        </View>
        <View style={{ paddingBottom: 15, paddingTop: 15}}>
          <Button
            backgroundColor={colors.red}
            icon={{name: 'verified-user', type: 'material'}}
            title='My Record Sharing Information'
            onPress={async () => {
              let keysCreated = await keysExist();
              if ( !keysCreated ) {
                Alert.alert(
                  'Coral Health Keys not present',
                  'Please create your Coral Health private and public keys by going to Settings > Account',
                  [
                    {text: 'OK', onPress: () => {} },
                  ],
                  { cancelable: true }
                )
              } else {
                try {
                  await nextFrame();
                  let sharedKey = await store.sharedPublickKey();

                  if ( !sharedKey ) {
                    await nextFrame();
                    let publicKey = await publicKeyPEM();

                    await nextFrame();
                    let keyHash = await ipfs.add(publicKey);

                    await nextFrame();
                    await store.setSharedPublicKey(keyHash);
                  }

                  await nextFrame();
                  let sharedInfo = await store.mySharedInfo();

                  this.props.navigation.navigate('QRCode', {
                    title:'Your Account QR Code',
                    subTitle: 'Show this to a friend or doctor to let them share or send you a medical record.',
                    shareMessage: 'This is my Coral Health medical record sharing public information. You can use this link to add me as a contact.',
                    data: sharedInfo, 
                    type: 'contact'});
                } catch (e) {
                  console.log('Error uploading to ipfs: ', e);
                  this.onShareKeyUploadFailed();
                }
              }
            }}
          />
        </View>
      </View>
    );
  }
}

function mapStateToProps({ records, removedRecords }) {
  return { updates: {added:records, removed:removedRecords} };
}

export const SharedRecordsScreen = connect(mapStateToProps)(SharedRecordsScreenUnwrapped);
