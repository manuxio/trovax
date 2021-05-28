import React from 'react';
import { Linking, ScrollView, Alert, StyleSheet, Text, View, TextInput, TouchableOpacity, Picker, Image, Dimensions  } from 'react-native';
import RNPickerSelect from 'react-native-picker-select';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import moment from 'moment/min/moment-with-locales';
import Promise from 'bluebird';
import Working from './Working';

const dimensions = Dimensions.get('window');
const imageHeight = Math.round(dimensions.width * 9 / 16);
const imageWidth = dimensions.width;

moment.locale('it');

const vaxCodesToName = {
  'VAC.99.120': 'Astrazeneca',
  'VAC.99.108': 'Pfizer',
  'VAC.99.110': 'Moderna',
  'VAC.99.122': 'Johnson & Johnson'
};

const storeData = async (key, value) => {
  try {
    const jsonValue = JSON.stringify(value);
    // console.log('Saving', key, 'as', jsonValue);
    await AsyncStorage.setItem(key, jsonValue);
  } catch (e) {
    // saving error
    console.error(e);
  }
}

const getData = async (key) => {
  try {
    const jsonValue = await AsyncStorage.getItem(key)
    return jsonValue != null ? JSON.parse(jsonValue) : null;
  } catch(e) {
    // error reading value
    console.error(e);
  }
}

export default class App extends React.Component {
  constructor(props) {
    super(props);
    const possibleDates = [];
    const possibleMinDates = [];
    const today = new Date();
    const d = moment(today);
    // alert(d.format('LLLL'));
    for (let i = 0; i < 30; i++) {
      const d = moment().add(i, 'days');
      // d.add(i, 'days');
      // alert(d.format('LLLL'));
      possibleDates.push({
        label: d.format('dddd D MMMM YYYY'),
        value: d.format('DD/MM/YYYY')
      });
      possibleMinDates.push({
        label: d.format('dddd D MMMM YYYY'),
        value: d.format('DD/MM/YYYY')
      })
    }
    this.state = {
      codicefiscale: '',
      team: '',
      vaccino: '',
      maxdate: '',
      mindate: '',
      possibleDates,
      possibleMinDates,
      cellulare: '',
      email: '',
      provincia: '',
      lastBooking: null
    };
  }
  async componentDidMount() {
    const keys = Object.keys(this.state);

    const myvalues = await Promise.mapSeries(keys, (k) => {
      return getData(k);
    });
    const newstate = {};
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (k !== 'possibleDates' && k !== 'possibleMinDates') {
        if (myvalues[i]) {
          // console.log('Found stored value', k, myvalues[i]);
          newstate[k] = myvalues[i];
        } else {
          // console.log('Invalid value', k, myvalues[i]);
        }
      }
    }
    this.setState(newstate);
  }
  async saveAllState() {
    const keys = Object.keys(this.state);
    return Promise.mapSeries(keys, (k) => {
      // console.log('Saving key', k);
      return storeData(k, this.state[k]);
    })
  }
  stop() {
    this.setState({
      start: false
    });
  }
  async saveLastBooking(booking) {
    return storeData('lastBooking', booking);
  }
  render(){
    const {
      start,
      lastBooking
    } = this.state;
    if (start) {
      return (
        <Working saveBooking={ (arg) => this.saveLastBooking(arg) } onStop={ () => this.stop()} {...this.state}/>
      )
    }
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Image source={require('./assets/innerlogo.png')} style={{
              height: 80,
              resizeMode: 'contain',
              marginBottom: 10
            }}/>
          <Text style={styles.logoverysmall}>by manu@cappelleri.net</Text>
        </View>
        {
          lastBooking && lastBooking.results
          ? (
            <>
              <Text style={styles.logoverysmall}>Ultima prenotazione { lastBooking.results[0].bookingCode }</Text>
            </>
          )
          : null
        }
        <>
          <ScrollView style={styles.paragraph}>
            <View style={styles.inputView} >
              <TextInput
                style={styles.inputText}
                placeholder="Codice Fiscale"
                autoCapitalize="characters"
                placeholderTextColor="#003f5c"
                value={this.state.codicefiscale}
                onChangeText={text => this.setState({codicefiscale:text})}/>
            </View>
            <View style={styles.inputView} >
              <TextInput
                // secureTextEntry
                style={styles.inputText}
                placeholder="N. Tessera Sanitaria 8038000..."
                keyboardType='number-pad'
                placeholderTextColor="#003f5c"
                value={this.state.team}
                onChangeText={text => this.setState({team:text})}/>
            </View>
            <View style={styles.inputView} >
              <TextInput
                // secureTextEntry
                style={styles.inputText}
                placeholder="Telefono cellulare"
                autoCompleteType="tel"
                keyboardType="phone-pad"
                placeholderTextColor="#003f5c"
                value={this.state.cellulare}
                onChangeText={text => this.setState({ cellulare: text})}/>
            </View>
            <View style={styles.inputView} >
              <TextInput
                // secureTextEntry
                style={styles.inputText}
                placeholder="Indirizzo email"
                autoCompleteType="email"
                keyboardType="email-address"
                placeholderTextColor="#003f5c"
                value={this.state.email}
                onChangeText={text => this.setState({ email: text})}/>
            </View>
            <View style={styles.inputView} >
              <RNPickerSelect
                useNativeAndroidPickerStyle={false}
                value={this.state.mindate}
                placeholder={{
                  label: "Non prima del giorno...",
                  value: "",
                  key: "none",
                  color: "#9EA0A4" ,
                }}
                style={{ inputIOS: styles.inputText, inputAndroid: styles.inputAndroid}}
                onValueChange={(value) => this.setState({
                  mindate: value
                })}
                items={this.state.possibleMinDates}
                />
            </View>
            <View style={styles.inputView} >
              <RNPickerSelect
                useNativeAndroidPickerStyle={false}
                value={this.state.maxdate}
                placeholder={{
                  label: "Entro il giorno...",
                  value: "",
                  key: "none",
                  color: "#9EA0A4" ,
                }}
                style={{ inputIOS: styles.inputText, inputAndroid: styles.inputAndroid}}
                onValueChange={(value) => this.setState({
                  maxdate: value
                })}
                items={this.state.possibleDates}
                />
            </View>
            <View style={styles.inputView} >
              <RNPickerSelect
                useNativeAndroidPickerStyle={false}
                value={this.state.vaccino}
                placeholder={{
                  label: "Scegli il vaccino",
                  value: "",
                  key: "none",
                  color: "#9EA0A4" ,
                }}
                style={{ inputIOS: styles.inputText, inputAndroid: styles.inputAndroid}}
                onValueChange={(value) => this.setState({
                  vaccino_name: vaxCodesToName[value],
                  vaccino: value
                })}
                items={Object.keys(vaxCodesToName).map((c) => {
                  return {
                    label: vaxCodesToName[c],
                    value: c
                  }
                })}
                />
            </View>
            <View style={styles.inputView} >
              <RNPickerSelect
                useNativeAndroidPickerStyle={false}
                value={this.state.provincia}
                placeholder={{
                  label: "Scegli la provincia",
                  value: "",
                  key: "none",
                  color: "#9EA0A4" ,
                }}
                style={{ inputIOS: styles.inputText, inputAndroid: styles.inputAndroid}}
                onValueChange={(value) => this.setState({
                  provincia: value
                })}
                items={[
                  { label: 'Roma', value: 'ROMA' },
                  { label: 'Frosinone', value: 'FROSINONE' },
                  { label: 'Latina', value: 'LATINA' },
                  { label: 'Rieti', value: 'RIETI' },
                  { label: 'Viterbo', value: 'VITERBO' },
                  { label: 'Tutta la regione', value: 'LAZIO' },
                ]}
                />
            </View>
          </ScrollView>
          <TouchableOpacity style={styles.loginBtn} onPress={async () => {
              await this.saveAllState();
              const {
                provincia,
                vaccino,
                codicefiscale,
                team,
                cellulare,
                email,
                maxdate
              } = this.state;
              if (!provincia || !vaccino || !codicefiscale || !cellulare || !email || !maxdate) {
                Alert.alert('Dati incompleti', 'Verifica di aver impostato tutti i dati');
              } else {
                this.setState({
                  start: true
                });
              }
            }}
          >
            <Text style={styles.loginText}>Avvia la ricerca</Text>
          </TouchableOpacity>
        </>




      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#4b4b4b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flex: 0,
    marginTop: 45,
    // height: "100%",
    // backgroundColor: 'red',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo:{
    fontWeight:"bold",
    fontSize:50,
    color:"#f0851d",
    marginBottom:5
  },
  logosmall: {
    fontWeight:"bold",
    fontSize:30,
    color:"#ff6000",
    marginBottom:5
  },
  logoverysmall: {
    fontWeight:"bold",
    fontSize:13,
    color:"#ff6000",
    marginBottom:5
  },
  inputView:{
    width:"100%",
    backgroundColor:"#ffffff",
    borderRadius:25,
    height:50,
    marginBottom:20,
    justifyContent:"center",
    padding:20
  },
  inputAndroid: {
    fontSize: 13,
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderWidth: 0,
    borderColor: 'white',
    borderRadius: 0,
    color: '#003f5c',
    height: 20,
    paddingRight: 30, // to ensure the text is never behind the icon
  },
  inputText:{
    height:50,
    color:"#003f5c"
  },
  forgot:{
    color:"white",
    fontSize:11
  },
  confirmBtn:{
    flex: 0,
    width:"80%",
    backgroundColor:"#5afbab",
    borderRadius:25,
    height:50,
    alignItems:"center",
    justifyContent:"center",
    marginTop:20,
    marginBottom:0
  },
  loginBtn:{
    width:"80%",
    backgroundColor:"#ff6000",
    borderRadius:25,
    height:50,
    alignItems:"center",
    justifyContent:"center",
    marginTop:5,
    marginBottom:40
  },
  backBtn:{
    width:"80%",
    backgroundColor:"#ff6000",
    borderRadius:25,
    height:50,
    alignItems:"center",
    justifyContent:"center",
    marginTop:20,
    marginBottom:40
  },
  loginText:{
    color:"white"
  },
  paragraph: {
    flex: 1,
    flexGrow: 1,
    width:"80%",
    color: 'white',
    margin: 24,
    fontSize: 18,
    textAlign: 'center',
    // backgroundColor:"grey",
  }
});