/**
 * What the scorecards cannot say about the players of the 2000s, for the past
 * seasons a career can start in (`npm run import:players -- --eras`).
 *
 * Cricsheet's international scorecards begin in 2003, so a player who was
 * already established then shows up with a "first match" years after his real
 * debut, and the usual estimate (first match at 21) makes Tendulkar 22 in
 * 2005. These are their real birth years, by Cricsheet scorecard name.
 *
 * The Mushtaq Ali scorecards begin in 2016, so the Indians who had stopped
 * playing domestic cricket by then have no state side in the data; these are
 * the sides they played for (`ALL_SIDES[].team`).
 */

export const LEGEND_BIRTH_YEARS: Record<string, number> = {
  // England
  'ME Trescothick': 1975, 'N Hussain': 1968, 'MP Vaughan': 1974, 'A Flintoff': 1977, 'AF Giles': 1973, 'MJ Hoggard': 1976,
  'AJ Stewart': 1963, 'PD Collingwood': 1976, 'SJ Harmison': 1978, 'JM Anderson': 1982, 'ID Blackwell': 1978, 'OA Shah': 1978,
  'D Gough': 1970, 'R Clarke': 1981, 'CMW Read': 1978, 'VS Solanki': 1976, 'AJ Strauss': 1977, 'GO Jones': 1976, 'IR Bell': 1982,
  'KP Pietersen': 1980, 'MJ Prior': 1982, 'CT Tremlett': 1981, 'LE Plunkett': 1985, 'AN Cook': 1984, 'MS Panesar': 1982, 'SI Mahmood': 1982,
  // India
  'VVS Laxman': 1974, 'SR Tendulkar': 1973, 'R Dravid': 1973, 'SC Ganguly': 1972, 'V Sehwag': 1978, 'A Kumble': 1970,
  'Harbhajan Singh': 1980, 'J Srinath': 1969, 'Yuvraj Singh': 1981, 'M Kaif': 1980, 'Z Khan': 1978, 'D Mongia': 1977,
  'AB Agarkar': 1977, 'A Nehra': 1979, 'PA Patel': 1985, 'G Gambhir': 1981, 'A Mishra': 1982, 'L Balaji': 1981, 'M Kartik': 1976,
  'IK Pathan': 1984, 'YK Pathan': 1982, 'RR Powar': 1978, 'KD Karthik': 1985, 'MS Dhoni': 1981, 'SK Raina': 1986, 'RP Singh': 1985,
  'S Sreesanth': 1983, 'W Jaffer': 1978, 'PP Chawla': 1988, 'MM Patel': 1983, 'RV Uthappa': 1985, 'RG Sharma': 1987,
  'I Sharma': 1988, 'P Kumar': 1986, 'M Vijay': 1984, 'S Badrinath': 1980, 'R Ashwin': 1986, 'V Kohli': 1988, 'PP Ojha': 1986,
  'AT Rayudu': 1985, 'RA Jadeja': 1988, 'S Dhawan': 1985, 'CA Pujara': 1988, 'Joginder Sharma': 1983, 'VRV Singh': 1984,
  'SS Tiwary': 1985, 'MK Tiwary': 1985, 'R Vinay Kumar': 1984, 'AM Nayar': 1983, 'NV Ojha': 1984, 'UT Yadav': 1987,
  // Sri Lanka
  'ST Jayasuriya': 1969, 'MS Atapattu': 1970, 'DPMD Jayawardene': 1977, 'RP Arnold': 1973, 'KC Sangakkara': 1977,
  'UDU Chandana': 1972, 'WPUJC Vaas': 1974, 'DNT Zoysa': 1978, 'CRD Fernando': 1979, 'HP Tillakaratne': 1967,
  'M Muralitharan': 1972, 'J Mubarak': 1981, 'DA Gunawardene': 1977, 'HAPW Jayawardene': 1979, 'KS Lokuarachchi': 1982,
  'TM Dilshan': 1976, 'KMDN Kulasekara': 1982, 'TT Samaraweera': 1976, 'SHT Kandamby': 1982, 'MF Maharoof': 1984,
  'HMRKB Herath': 1978, 'SL Malinga': 1983, 'WU Tharanga': 1985, 'HMCM Bandara': 1979, 'PDRL Perera': 1977,
  'CK Kapugedera': 1987, 'KTGD Prasad': 1983, 'MG Vandort': 1980,
  // Australia
  'JL Langer': 1970, 'ML Hayden': 1971, 'RT Ponting': 1974, 'DR Martyn': 1971, 'AC Gilchrist': 1971, 'B Lee': 1976,
  'JN Gillespie': 1975, 'SCG MacGill': 1971, 'GD McGrath': 1970, 'AJ Bichel': 1970, 'GB Hogg': 1971, 'A Symonds': 1975,
  'MG Bevan': 1970, 'SR Watson': 1981, 'DS Lehmann': 1970, 'BA Williams': 1974, 'NW Bracken': 1977, 'MJ Clarke': 1981,
  'SK Warne': 1969, 'IJ Harvey': 1972, 'NM Hauritz': 1981, 'SM Katich': 1975, 'BJ Haddin': 1977, 'MEK Hussey': 1975,
  'MS Kasprowicz': 1972, 'JR Hopes': 1978, 'SW Tait': 1983, 'SR Clark': 1975, 'CL White': 1983, 'BJ Hodge': 1974,
  'PA Jaques': 1979, 'MG Johnson': 1981,
  // South Africa
  'GC Smith': 1981, 'HH Gibbs': 1974, 'G Kirsten': 1967, 'JH Kallis': 1975, 'HH Dippenaar': 1977, 'ND McKenzie': 1975,
  'MV Boucher': 1976, 'SM Pollock': 1973, 'N Boje': 1973, 'M Ntini': 1977, 'CK Langeveldt': 1974, 'RJ Peterson': 1980,
  'AJ Hall': 1975, 'M Zondeki': 1982, 'JA Rudolph': 1981, 'A Nel': 1977, 'MN van Wyk': 1979, 'JP Duminy': 1984,
  'HM Amla': 1983, 'JL Ontong': 1980, 'AB de Villiers': 1984, 'AG Prince': 1977, 'JM Kemp': 1977, 'JA Morkel': 1981,
  'J Botha': 1982, 'JJ van der Wath': 1978, 'LE Bosman': 1977,
  // Pakistan
  'Taufeeq Umar': 1981, 'Younis Khan': 1977, 'Inzamam-ul-Haq': 1970, 'Yousuf Youhana': 1974, 'Mohammad Yousuf': 1974,
  'Faisal Iqbal': 1981, 'Abdul Razzaq': 1979, 'Kamran Akmal': 1982, 'Mohammad Sami': 1981, 'Rashid Latif': 1968,
  'Shoaib Akhtar': 1975, 'Shahid Afridi': 1980, 'Mohammad Hafeez': 1980, 'Umar Gul': 1984, 'Shoaib Malik': 1982,
  'Danish Kaneria': 1980, 'Naved-ul-Hasan': 1978, 'Misbah-ul-Haq': 1974, 'Yasir Hameed': 1978, 'Shabbir Ahmed': 1976,
  'Imran Nazir': 1981, 'Salman Butt': 1984, 'Imran Farhat': 1982, 'Moin Khan': 1971, 'Iftikhar Anjum': 1980,
  'Yasir Arafat': 1982, 'Mohammad Asif': 1982,
  // New Zealand
  'SP Fleming': 1973, 'NJ Astle': 1971, 'MS Sinclair': 1975, 'CD McMillan': 1976, 'L Vincent': 1978, 'JDP Oram': 1978,
  'BB McCullum': 1981, 'KD Mills': 1979, 'DL Vettori': 1979, 'DR Tuffey': 1978, 'SB Styris': 1975, 'AR Adams': 1975,
  'CZ Harris': 1969, 'CL Cairns': 1970, 'SE Bond': 1975, 'IG Butler': 1981, 'CD Cumming': 1975, 'HJH Marshall': 1979,
  'MJ Mason': 1974, 'CS Martin': 1974, 'JEC Franklin': 1980, 'GJ Hopkins': 1976, 'PG Fulton': 1979, "IE O'Brien": 1976,
  'JS Patel': 1980, 'JM How': 1981, 'LRPL Taylor': 1984,
  // West Indies
  'CH Gayle': 1979, 'BC Lara': 1969, 'RR Sarwan': 1980, 'S Chanderpaul': 1974, 'RD Jacobs': 1967, 'M Dillon': 1976,
  'WW Hinds': 1981, 'RL Powell': 1978, 'CD Collymore': 1977, 'DS Smith': 1983, 'D Ganga': 1979, 'MN Samuels': 1981,
  'CS Baugh': 1982, 'DE Bernard': 1981, 'DBL Powell': 1978, 'JE Taylor': 1984, 'FH Edwards': 1982, 'R Rampaul': 1984,
  'DR Smith': 1981, 'TL Best': 1981, 'DJ Bravo': 1983, 'IDR Bradshaw': 1974, 'DJG Sammy': 1984, 'N Deonarine': 1983,
  'XM Marshall': 1986, 'RS Morton': 1978, 'D Ramdin': 1985,
  // Zimbabwe
  'T Taibu': 1983, 'HH Streak': 1974, 'GW Flower': 1970, 'BRM Taylor': 1986, 'H Masakadza': 1983, 'E Chigumbura': 1986,
  'P Utseya': 1985, 'SC Williams': 1986, 'AG Cremer': 1986, 'S Matsikenyeri': 1983, 'MA Vermeulen': 1979,
  'CB Wishart': 1974, 'DD Ebrahim': 1980, 'AM Blignaut': 1978, 'SM Ervine': 1982, 'DT Hondo': 1979, 'RW Price': 1976,
  'CK Coventry': 1983, 'V Sibanda': 1983, 'CJ Chibhabha': 1986,
  // Bangladesh
  'Habibul Bashar': 1972, 'Khaled Mashud': 1976, 'Mashrafe Mortaza': 1983, 'Mohammad Rafique': 1970,
  'Mohammad Ashraful': 1984, 'Khaled Mahmud': 1971, 'Javed Omar': 1976, 'Rajin Saleh': 1983, 'Abdur Razzak': 1982,
  'Aftab Ahmed': 1985, 'Shahriar Nafees': 1986, 'Mushfiqur Rahim': 1987, 'Hannan Sarkar': 1982, 'Alok Kapali': 1984,
  'Tapash Baisya': 1982, 'Enamul Haque jnr': 1986, 'Nafees Iqbal': 1985, 'Manjural Islam Rana': 1984, 'Syed Rasel': 1984,
  'Shahadat Hossain': 1986, 'Tushar Imran': 1983,
};

export const LEGEND_STATES: Record<string, string> = {
  'SR Tendulkar': 'Mumbai', 'R Dravid': 'Karnataka', 'SC Ganguly': 'Bengal', 'VVS Laxman': 'Hyderabad', 'V Sehwag': 'Delhi',
  'A Kumble': 'Karnataka', 'Harbhajan Singh': 'Punjab', 'J Srinath': 'Karnataka', 'Yuvraj Singh': 'Punjab',
  'M Kaif': 'Uttar Pradesh', 'Z Khan': 'Mumbai', 'D Mongia': 'Punjab', 'AB Agarkar': 'Mumbai', 'A Nehra': 'Delhi',
  'PA Patel': 'Gujarat', 'G Gambhir': 'Delhi', 'A Mishra': 'Haryana', 'L Balaji': 'Tamil Nadu', 'M Kartik': 'Railways',
  'IK Pathan': 'Baroda', 'YK Pathan': 'Baroda', 'RR Powar': 'Mumbai', 'KD Karthik': 'Tamil Nadu', 'MS Dhoni': 'Jharkhand',
  'SK Raina': 'Uttar Pradesh', 'RP Singh': 'Uttar Pradesh', 'S Sreesanth': 'Kerala', 'W Jaffer': 'Mumbai',
  'PP Chawla': 'Uttar Pradesh', 'MM Patel': 'Baroda', 'RV Uthappa': 'Karnataka', 'RG Sharma': 'Mumbai', 'I Sharma': 'Delhi',
  'P Kumar': 'Uttar Pradesh', 'M Vijay': 'Tamil Nadu', 'S Badrinath': 'Tamil Nadu', 'R Ashwin': 'Tamil Nadu', 'V Kohli': 'Delhi',
  'PP Ojha': 'Hyderabad', 'AT Rayudu': 'Hyderabad', 'RA Jadeja': 'Saurashtra', 'S Dhawan': 'Delhi', 'CA Pujara': 'Saurashtra',
  'Joginder Sharma': 'Haryana', 'VRV Singh': 'Punjab', 'SS Tiwary': 'Jharkhand', 'MK Tiwary': 'Bengal',
  'R Vinay Kumar': 'Karnataka', 'AM Nayar': 'Mumbai', 'NV Ojha': 'Madhya Pradesh', 'UT Yadav': 'Vidarbha',
};
