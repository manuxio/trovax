import React from 'react';
import { Audio } from "expo-av";
import { Image, Linking, ScrollView, StyleSheet, Text, View, TextInput, TouchableOpacity, Picker } from 'react-native';
import md5 from 'md5';
import moment from 'moment';

const MAX_SEARCHES = 2 * 10 * 6;
const SEARCH_DELAY = 5;

const vaxCodesToName = {
  'VAC.99.120': 'Astrazeneca',
  'VAC.99.108': 'Pfizer',
  'VAC.99.110': 'Moderna',
  'VAC.99.122': 'Johnson & Johnson'
};

export default class Working extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      working: true,
      finalStatus: null,
      token: null,
      cookies: null,
      messages: [],
      searchCount: 0,
      validServicePointsCodes: [],
      slot: null,
      readyToBook: false
    };
  }
  componentDidMount() {
    console.log('Starting.........');
    this.doLogin();
  }
  maybeRestartSearch() {
    const {
      halted,
      messages
    } = this.state;
    if (halted) return;
    if (this.state.searchCount < MAX_SEARCHES) {
      this.setState({
        slot: null,
        messages: [...this.state.messages, `❌ Nessuna disponibilità, riprovo fra ${SEARCH_DELAY} secondi...`]
      }, () => {
        this.timeout = setTimeout(() => {
          this.doSearchSlots();
        }, 1000 * SEARCH_DELAY);
      })
    } else {
      this.setState({
        slot: null,
        messages: [...this.state.messages, `❌ Raggiunto il massimo numero di tentativi consecutivi.`]
      }, this.halt);
    }
  }
  doSearchSlots() {
    const {
      token,
      cookies,
      searchCount,
      messages,
      halted
    } = this.state;
    const {
      mindate
    } = this.props;
    if (halted) return;
    if (searchCount < MAX_SEARCHES) {
      this.setState({
        searchCount: searchCount + 1,
        messages: [...messages, `ℹ Tentativo n. ${searchCount + 1} / ${MAX_SEARCHES}`]
      }, () => {
        // console.log('SENT DATE', moment().endOf('day').toISOString());
        this.doPostReq("https://prenotavaccino-covid.regione.lazio.it/rest/search-resources",
        {
          "paymentSubject":"VAC",
          "priorityCode":"",
          "language":"it",
          "type":2,
          "maxDistance":0,
          "searchSynchro":false,
          "searchNear":false,
          "sameDiary":false,
          "maxResults":200,
          "weekdays":"1111111",
          "idExams":[{"encodingSystem":"VACC_LAZ"}],
          "startDate": mindate ? moment(mindate, 'DD/MM/YYYY').endOf('day').toISOString() : moment().endOf('day').toISOString(),
        }, token, cookies)
        .then(async res => {
          // console.log('COOKIES', res.headers, res.headers.map['set-cookie']);
          return { body: await res.json() };
        })
        .then(
          ({body}) => {
            // console.log(body);
            const {
              vaccino,
              provincia,
              vaccino_name
            } = this.props;
            const {
              validServicePointsCodes
            } = this.state;
            const {
              providers
            } = body;
            if (!providers) {
              // console.log(body);
              throw new Error('Not loaded');
            }
            let invalidVaccines = 0;
            let invalidDates = 0;
            let invalidSites = 0;
            const validProviders = providers.filter((prov, provPos) => {
              // if (prov.displayName.toUpperCase().indexOf('ASTR') < 0) {
              //   console.log(prov.displayName,prov.siteName);
              // }
              // return prov.displayName.toUpperCase().indexOf('JOHN') > -1;
              // console.log('MAXDATE', this.props.maxdate);
              if (prov.examId === vaccino && validServicePointsCodes.indexOf(prov.siteId) > -1) {
                const {
                  slots
                } = prov;
                // console.log(prov.examId === vaccino, validServicePointsCodes.indexOf(prov.siteId), slots.length);
                if (slots && slots.length > 0) {
                  // console.log('I have slots!');
                  const goodSlots = slots.filter((slot) => {
                    const { datetime } = slot;
                    const dt = moment(datetime);
                    // console.log('Filtering slot', dt.format('DD/MM/YYYY'), 'before', moment(this.props.maxdate, 'DD/MM/YYYY').format('DD/MM/YYYY'));
                    if (dt.isBefore(moment(this.props.maxdate, 'DD/MM/YYYY').endOf('day'))) {
                      console.log('Good is before');
                      if (this.props.mindate) {
                        if (!dt.isAfter(moment(this.props.mindate, 'DD/MM/YYYY').startOf('day'))) {
                          console.log(provPos, prov.address.street);
                          console.log(provPos, 'Invalid date (too early)', dt.format('DD/MM/YYYY HH:mm:ss'), moment(this.props.mindate, 'DD/MM/YYYY').format('DD/MM/YYYY HH:mm:ss'));
                          // invalidDates++;
                          return false;
                        }
                        console.log('Is After!', dt.format('DD/MM'), moment(this.props.mindate, 'DD/MM/YYYY').startOf('day').format('DD/MM'));
                        return true;
                      } else {
                        console.log(provPos, 'No min date provided! Slot is good');
                        return true;
                      }
                    } else {
                      console.log(prov.address.street);
                      console.log(provPos, 'Invalid date (too late)', dt.format('DD/MM/YYYY HH:mm:ss'));
                      // invalidDates++;
                    }
                  });
                  // console.log(goodSlots);
                  if (goodSlots.length < 1) {
                    invalidDates++;
                  }
                  return goodSlots.length > 0;
                  // const [firstSlot] = slots;
                  // // const firstSlot = slots[Math.floor(Math.random() * slots.length)];
                  // const { datetime } = firstSlot;
                  // const dt = moment(datetime);
                  // if (dt.isBefore(moment(this.props.maxdate, 'DD/MM/YYYY').endOf('day'))) {
                  //   if (this.props.mindate) {
                  //     if (!dt.isAfter(moment(this.props.mindate, 'DD/MM/YYYY').startOf('day'))) {
                  //       console.log(prov);
                  //       console.log('Invalid date (too early)', dt.format('DD/MM/YYYY HH:mm:ss'));
                  //       return false;
                  //     }
                  //   }
                  //   console.log(dt.format('DD/MM/YYYY'), moment(this.props.maxdate, 'DD/MM/YYYY').endOf('day').format('DD/MM/YYYY'));
                  //   console.log(prov.examId, prov.displayName,prov.siteName, dt.format('DD/MM/YYYY HH:mm:ss'));
                  //   return true;
                  // } else {
                  //   console.log('Invalid date (too late)', dt.format('DD/MM/YYYY HH:mm:ss'));
                  //   return false;
                  //   // console.log(prov.examId, prov.displayName,prov.siteName, dt.format('DD/MM/YYYY HH:mm:ss'));
                  // }
                }
                return false;
              }
              if (prov.examId === vaccino) {
                // console.log(provPos, 'Invalid site', prov.siteName);
                if (validServicePointsCodes.indexOf(prov.siteId) < 0) {
                  invalidSites++;
                }
              } else {
                invalidVaccines++;
                // console.log(provPos, 'Invalid vaccine', prov.examId, '!=', vaccino);
              }
              return false;
            });
            if (validProviders && validProviders.length > 0) {
              // console.log('validProviders', validProviders);
              console.log(validProviders.length, Math.floor(Math.random() * validProviders.length));
              const first = validProviders[validProviders.length > 1 ? 1 : 0];
              console.log('First', first);
              console.log('Got', first.siteName, moment(first.slots[0].datetime).format('DD/MM/YYYY HH:mm:ss'));
              console.log(first);
              const toAdd = [];
              // if (invalidVaccines > 0) {
              //   toAdd.push(`ℹ Ho scartato ${invalidVaccines} disponibilità perché erano per un vaccino diverso da quello scelto`);
              // }
              if (invalidDates > 0) {
                toAdd.push(`ℹ Ho scartato ${invalidDates} disponibilità perché erano in date diverse da quelle impostate`);
              }
              if (invalidSites > 0) {
                toAdd.push(`ℹ Ho scartato ${invalidSites} disponibilità perché erano fuori dalla provincia selezionata`);
              }
              toAdd.push(`✅ Trovata disponibilità presso ${first.siteName} (${first.address.street||'-'}) con vaccino ${vaccino_name} per il giorno ${moment(first.slots[0].datetime).format('DD/MM/YYYY [alle ore] HH:mm')}. Tento la prima fase della prenotazione...`);
              this.setState({
                slot: first,
                messages: [...this.state.messages, ...toAdd]
              }, this.doLockOne)
            } else {
              // console.log('REALLY HERE!!');
              const toAdd = [];
              // if (invalidVaccines > 0) {
              //   toAdd.push(`ℹ Ho scartato ${invalidVaccines} disponibilità perché erano per un vaccino diverso da quello scelto`);
              // }
              if (invalidDates > 0) {
                toAdd.push(`ℹ Ho scartato ${invalidDates} disponibilità perché erano in date diverse da quelle impostate`);
              }
              if (invalidSites > 0) {
                toAdd.push(`ℹ Ho scartato ${invalidSites} disponibilità perché erano fuori dalla provincia selezionata`);
              }
              if (toAdd.length > 0) {
                this.setState({
                  messages: [...this.state.messages, ...toAdd]
                }, this.maybeRestartSearch);
              } else {
                this.maybeRestartSearch();
              }
            }
          }
        )
        .catch(
          (e) => {
            console.error(e);
            this.onError(e);
          }
        )
      })
    } else {
      console.log('No more tries!');
    }
  }
  doLockOne() {
    const {
      token,
      cookies,
      slot,
      halted
    } = this.state;
    if (halted) return;
    const body = {"paymentSubject":"VAC","idExams":[{"code":slot.examId,"encodingSystem":"VACC_LAZ","requestId":"A1"}],"startDate":moment().startOf('day').toISOString(),"diaryIds":{"diaryId":[slot.diaryId]}};
    this.doPostReq("https://prenotavaccino-covid.regione.lazio.it/rest/lock-resource", body, token, cookies)
    .then(async res => {
      // console.log('COOKIES', res.headers, res.headers.map['set-cookie']);
      return { body: await res.json() };
    })
    .then(
      ({body}) => {
        if (body && body.providers && body.providers.length > 0) {
          console.log('Got a valid lock one', body);
          this.setState({
            messages: [...this.state.messages, `✅ Prima fase a buon fine. Proseguo...`],
            lock1: body
          }, this.doLockTwo);
        } else {
          console.log('Invalid lock one', body);
          this.setState({
            messages: [...this.state.messages, `❌ Tentativo fallito`]
          }, this.maybeRestartSearch);

        }
      }
    )
    .catch(
      (e) => {
        console.error(e);
        this.onError(e);
      }
    )
  }
  doLockTwo() {
    const {
      token,
      cookies,
      slot,
      halted
    } = this.state;
    if (halted) return;
    if (slot.relatedProviders && slot.relatedProviders[0]) {
      const service = slot.relatedProviders[0];
      const body = {"paymentSubject":"VAC","idExams":[{"code":service.examId,"encodingSystem":"VACC_LAZ","requestId":"A1"}],"startDate":moment().endOf('day').toISOString(),"diaryIds":{"diaryId":[service.diaryId]}};
      this.doPostReq("https://prenotavaccino-covid.regione.lazio.it/rest/lock-resource", body, token, cookies)
      .then(async res => {
        // console.log('COOKIES', res.headers, res.headers.map['set-cookie']);
        return { body: await res.json() };
      })
      .then(
        ({body}) => {
          if (body && body.providers && body.providers.length > 0) {
            console.log('Got a valid lock two', body);
            this.setState({
              messages: [...this.state.messages, `✅ Seconda fase a buon fine. Conferma entro 60 secondi con il pulsante per concludere la prenotazione oppure Interrompi`],
              lock2: body
            }, this.askBookConfirm);
          } else {
            console.log('Invalid lock two', body);
            this.setState({
              messages: [...this.state.messages, `❌ Tentativo fallito`]
            }, this.maybeRestartSearch);

          }
        }
      )
      .catch(
        (e) => {
          console.error(e);
          this.onError(e);
        }
      )
    } else {
      this.setState({
        messages: [...this.state.messages, `✅ Questo vaccino non richiede la fase due. Conferma entro 60 secondi con il pulsante per avviare la prenotazione.`]
      }, this.askBookConfirm);
    }
  }
  async askBookConfirm() {
    const {
      halted
    } = this.state;
    if (halted) return;
    this.setState({
      readyToBook: true,
    });
    const { sound } = await Audio.Sound.createAsync(
       require('./assets/beep.mp3')
    );
    await sound.playAsync();
  }
  doBook() {
    const {
      lock1,
      lock2,
      slot,
      halted,
      token,
      cookies
    } = this.state;
    if (halted) return;
    let bookingJson;
      if (lock2) {
        bookingJson = require('./booking.json');
        const secondService = slot.relatedProviders[0];
        const hs1 = slot.healthServices[0];
        const hs2 = secondService.healthServices[0];
        bookingJson.bookings[0].serviceId = slot.serviceId;
        bookingJson.bookings[1].serviceId = slot.serviceId;
        bookingJson.bookings[0].diaryId = slot.diaryId;
        bookingJson.bookings[1].diaryId = secondService.diaryId;
        bookingJson.bookings[0].siteName = slot.siteName;
        bookingJson.bookings[1].siteName = secondService.siteName;
        bookingJson.bookings[0].unitId = slot.unitId;
        bookingJson.bookings[1].unitId = secondService.unitId;
        bookingJson.bookings[0].slot = slot.slots[0];
        bookingJson.bookings[1].slot = secondService.slots[0];
        bookingJson.bookings[0].prescriptionItems[0].displayName = hs1.displayName;
        bookingJson.bookings[1].prescriptionItems[0].displayName = hs2.displayName;
        bookingJson.bookings[0].prescriptionItems[0].codes = hs1.codes;
        bookingJson.bookings[1].prescriptionItems[0].codes = hs2.codes;
        bookingJson.bookings[0].patientDetails.mobile = this.props.cellulare;
        bookingJson.bookings[1].patientDetails.mobile = this.props.cellulare;
        bookingJson.bookings[0].patientDetails.mail = this.props.email;
        bookingJson.bookings[1].patientDetails.mail = this.props.email;
        bookingJson.bookings[0].applicantDetails.mobile = this.props.cellulare;
        bookingJson.bookings[1].applicantDetails.mobile = this.props.cellulare;
      } else {
        bookingJson = require('./booking1.json');
        const hs1 = slot.healthServices[0];
        bookingJson.bookings[0].serviceId = slot.serviceId;
        bookingJson.bookings[0].diaryId = slot.diaryId;
        bookingJson.bookings[0].siteName = slot.siteName;
        bookingJson.bookings[0].unitId = slot.unitId;
        bookingJson.bookings[0].slot = slot.slots[0];
        bookingJson.bookings[0].prescriptionItems[0].displayName = hs1.displayName;
        bookingJson.bookings[0].prescriptionItems[0].codes = hs1.codes;
        bookingJson.bookings[0].patientDetails.mobile = this.props.cellulare;
        bookingJson.bookings[0].patientDetails.mail = this.props.email;
        bookingJson.bookings[0].applicantDetails.mobile = this.props.cellulare;
        // delete bookingJson.bookings[1];
      }
      console.log(bookingJson);
      this.doPostReq("https://prenotavaccino-covid.regione.lazio.it/rest/book-resources", bookingJson, token, cookies)
      .then(async res => {
        // console.log('COOKIES', res.headers, res.headers.map['set-cookie']);
        return { body: await res.json() };
      })
      .then(({ body }) => {
        console.log('Booking result', body);
        if (body && body.results && body.results.length > 0) {
          // console.log('Booked correctly!!');
          console.log(body);
          this.props.saveBooking(body);
          const {
            bookingCode
          } = body.results[0];
          this.setState({
            working: false,
            booking: body,
            messages: [...this.state.messages, `✅ Prenotazione avvenuta con successo!!! Il tuo numero di prenotazione è: ${bookingCode}. Salva uno screenshot di questa pagina per tua sicurezza e accedi al portale della Regione Lazio per scaricare il PDF della tua prenotazione. Dovresti ricevere a breve uno o due sms di conferma da parte della Regione Lazio sul numero di telefono indicato.`]
          });
        } else {
          console.log('retval', body);
          this.setState({
            working: false,
            messages: [...this.state.messages, `❌ Prenotazione NON riuscita.`]
          });
          // messages: [...this.state.messages, `✅ Prenotazione avvenuta con successo!!! Il tuo numero di prenotazione è: ${bookingCode}. Salva uno screenshot di questa pagina per tua sicurezza e accedi al portale della Regione Lazio per scaricare il PDF della tua prenotazione. Dovresti ricevere a breve uno o due sms di conferma da parte della Regione Lazio sul numero di telefono indicato.`]
          throw new Error('Unable to book!!!');
        }
      })
      .catch(
        (e) => {
          console.error(e);
          this.onError(e);
        }
      );
  }
  fetchPdf() {
    const {
      token,
      cookie,
      booking
    } = this.state;
    const postBody = {"contextID":"VACC_LAZ","language":"it","idBooking":booking.results[0].idBooking,"pdf":"true"};
    this.doPostReq("https://prenotavaccino-covid.regione.lazio.it/rest/search-bookings", bookingJson, token, cookies)
    .then(async res => {
      // console.log('COOKIES', res.headers, res.headers.map['set-cookie']);
      return { body: await res.json() };
    })
    .then(
      ({body}) => {
        console.log(body);
        if (body && body.bookings) {
          const myBooking = body.bookings[0];
        }
      }
    )
  }
  doCheckPatient() {
    const {
      cookies,
      token,
      halted
    } = this.state;
    if (halted) return;
    // https://prenotavaccino-covid.regione.lazio.it/rest/profile/check-patient
    this.setState({
      messages: [...this.state.messages, 'ℹ Verifica assistito in corso...']
    });
    this.doPostReq("https://prenotavaccino-covid.regione.lazio.it/rest/profile/check-patient", {"contextID":"VACC_LAZ","language":"it","paymentSubject":"VAC"}, token, cookies)
    .then(async res => {
      // console.log('COOKIES', res.headers, res.headers.map['set-cookie']);
      return { body: await res.json() };
    })
    .then(({ body }) => {
      // console.log(body);
      if (body && body.error) {
        this.setState({
          messages: [...this.state.messages, '❌Prenotazione non eseguibile. E\' possibile che per questo assistito sia già presente una prenotazione o che la fascia d\'età non sia ancora vaccinabile.']
        }, this.halt);
      } else {
        // console.log('B', body);
        if (body) {
          this.setState({
            messages: [...this.state.messages, '✅ Prenotazione possibile. Avvio ricerca...']
          }, this.doSearchFacilities)
        } else {

        }
      }
    })
    .catch(
      (e) => {
        console.error(e);
        this.onError(e);
      }
    );
  }
  doSearchFacilities() {
    const {
      cookies,
      token,
      halted
    } = this.state;
    if (halted) return;
    const {
      vaccino,
      provincia
    } = this.props;
    // https://prenotavaccino-covid.regione.lazio.it/rest/profile/check-patient
    this.setState({
      messages: [...this.state.messages, 'ℹ Cerco i possibili centri vaccinali...']
    });
    this.doPostReq("https://prenotavaccino-covid.regione.lazio.it/rest/search-health-services", {"contextID":"VACC_LAZ","paymentSubject":"VAC","language":"it","cupCode": vaccino}, token, cookies)
    .then(async res => {
      // console.log('COOKIES', res.headers, res.headers.map['set-cookie']);
      return { body: await res.json() };
    })
    .then(({ body }) => {
      // console.log(body);
      if (!body || !Array.isArray(body)) {
        console.log('No body');
        throw new Error('Unable to load facilities');
      }
      const [response] = body;
      if (!response) {
        console.log('No response');
        throw new Error('Unable to load facilities');
      }
      const { codes } = response;
      if (!codes) {
        console.log('No codes');
        throw new Error('Unable to load facilities');
      }
      const [ code ] = codes;
      if (!code) {
        console.log('No code');
        throw new Error('Unable to load facilities');
      }
      const { servicePoints } = code;
      if (!servicePoints || servicePoints.length < 1) {
        this.setState({
          messages: [...this.state.messages, '❌ Nessun centro vaccinale disponibile...']
        }, this.halt);
      } else {
        // console.log(servicePoints.map(d => d.districtName));
        const goodPoints = servicePoints.filter(sp => provincia === 'LAZIO' || sp.districtName.indexOf(provincia) > -1);

        const validServicePointsCodes = goodPoints.map(sp => sp.servicePointCode);
        if (validServicePointsCodes.length > 0) {
          this.setState({
            validServicePointsCodes,
            messages: [...this.state.messages, `ℹ Trovato ${validServicePointsCodes.length} possibili centri vaccinali`]
          }, this.doSearchSlots);
        } else {
          this.setState({
            messages: [...this.state.messages, '❌ Nessun centro vaccinale disponibile...']
          }, this.halt);
        }
      }
    })
    .catch(
      (e) => {
        console.error(e);
        this.onError(e);
      }
    );
  }
  doLogin() {
    // console.log('PROPS', this.props);
    const {
      codicefiscale,
      team
    } = this.props;
    const {
      halted
    } = this.state;
    if (halted) return;
    // return;
    let myteam = team;
    // if (team.indexOf('8038000') === 0) {
    //   myteam = myteam.substr(7);
    // }
    this.setState({
      messages: [...this.state.messages, 'ℹ Accesso in corso...']
    });
    this.doPostReq("https://prenotavaccino-covid.regione.lazio.it/rest/v2/authentication", {
      "contextID": "VACC_LAZ",
      "username":codicefiscale.toLowerCase(),
      "deviceSerialNumber":"303558731",
      "platform":"Browser",
      "platformVersion":"Windows NT 10.0",
      "model":"Chrome 90.0",
      "appVersion":"021102",
      "paymentSubject": myteam ? 'VAC' : 'VAC_AIRE',
      "password":myteam ? md5(myteam) : undefined,
      "passwordDecrypted": myteam || undefined
    })
    .then(async res => {
      // console.log('COOKIES', res.headers, res.headers.map['set-cookie']);
      const cookies = res.headers.map['set-cookie'];
      return { cookies, body: await res.json() };
    })
    .then(({cookies, body}) => {
      // console.log({
      //   "contextID": "VACC_LAZ",
      //   "username":codicefiscale.toLowerCase(),
      //   "deviceSerialNumber":"303558731",
      //   "platform":"Browser",
      //   "platformVersion":"Windows NT 10.0",
      //   "model":"Chrome 90.0",
      //   "appVersion":"021102",
      //   "paymentSubject":"VAC",
      //   "password":md5(myteam),
      //   "passwordDecrypted":myteam
      // });
      // console.log('BODY', body);
      // console.log(body);
      if (body && body.result) {
        this.setState({
          cookies,
          token: body.token,
          messages: [...this.state.messages, 'ℹ Accesso eseguito...']
        }, () => {
          if (codicefiscale === 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX') {
            this.doSearchFacilities();
          } else {
            this.doCheckPatient();
          }
        });
      } else {
        // console.log(body);
        this.setState({
          messages: [...this.state.messages, '❌Accesso fallito...']
        }, this.halt());
      }
    })
    .catch(
      (e) => {
        this.onError(e);
      }
    )
  }
  halt() {
    this.setState({
      working: false,
      slot: null,
      lock1: null,
      lock2: null,
      readyToBook: false,
      halted: true,
      messages: [...this.state.messages, '❌ Ricerca interrotta. Torna indietro per ricominciare.']
    });
  }
  onError(e) {
    console.error(e);
    this.setState({
      working: false,
      finalStatus: e.message,
      messages: [...this.state.messages, '❌ Errore inatteso! Ricerca interrotta!']
    });
  }
  render(){
    const {
      working,
      messages,
      readyToBook
    } = this.state;
    const nMessages = 10;
    // ${Math.max(messages.length - nMessages + 1, 1) + pos})
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
        <ScrollView style={styles.paragraph}>
          {messages.map((m, pos) => {
            return (
              <Text key={`${m}_${pos}`} style={{ width: '100%', marginBottom: 5, color: 'white' }}>
                {`${m}`}
              </Text>
            )
          }).reverse()}
        </ScrollView>
        {
          readyToBook
          ? (
            <TouchableOpacity style={styles.confirmBtn} onPress={async () => {
              this.setState({
                readyToBook: false
              }, this.doBook);
            }}
            >
            <Text style={styles.confirmText}>Esegui prenotazione</Text>
            </TouchableOpacity>
          )
          : null

        }
        {
          working
          ? (
            <TouchableOpacity style={styles.loginBtn} onPress={async () => {
              this.halt();
            }}
            >
            <Text style={styles.loginText}>Interrompi</Text>
            </TouchableOpacity>
          )
          : (
            <TouchableOpacity style={styles.loginBtn} onPress={async () => {
              if (this.timeout) {
                clearTimeout(this.timeout);
              }
              this.props.onStop();
            }}
            >
            <Text style={styles.loginText}>Indietro</Text>
            </TouchableOpacity>
          )
        }

      </View>
    );
  }
  doPostReq(url, body, token, cookies) {
    const options = {
      "headers": {
        "accept": "application/json",
        "accept-language": "en,it-IT;q=0.9,it;q=0.8,en-US;q=0.7",
        "cache-control": "no-cache",
        // "cookie": cookies,
        "content-type": "application/json; charset=UTF-8",
        "pragma": "no-cache",
        "sec-ch-ua": "\" Not A;Brand\";v=\"99\", \"Chromium\";v=\"90\", \"Google Chrome\";v=\"90\"",
        "sec-ch-ua-mobile": "?0",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        // "token": token,
        "x-requested-with": "XMLHttpRequest"
      },
      "referrer": "https://prenotavaccino-covid.regione.lazio.it/main/booking/availability",
      "referrerPolicy": "strict-origin-when-cross-origin",
      // "body": '{"contextID":"VACC_LAZ","username":"dzinys73a48z504p","deviceSerialNumber":"303558731","platform":"Browser","platformVersion":"Windows NT 10.0","model":"Chrome 90.0","appVersion":"021102","paymentSubject":"VAC","password":"be3492617b630348b31ff6877418df7b","passwordDecrypted":"80380001200176728115"}',
      "method": "POST"
    };
    if (token) {
      options.headers.token = token;
    }
    if (cookies) {
      options.headers.cookies = cookies;
    }
    if (body) {
      options.body = JSON.stringify(body);
    }
    return fetch(url, options);
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
    marginBottom:20
  },
  loginBtn:{
    width:"80%",
    backgroundColor:"#ff6000",
    borderRadius:25,
    height:50,
    alignItems:"center",
    justifyContent:"center",
    marginTop:0,
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