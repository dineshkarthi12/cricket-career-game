/**
 * Regional name pools for fictional cricketers. Every name is a random pairing
 * of a common first name and a common family name from the region - no real
 * player is modelled, and famous pairings are rerolled (`FAMOUS`).
 */

export type NamePool =
  | 'TAMIL'
  | 'KANNADA'
  | 'MALAYALAM'
  | 'TELUGU'
  | 'MARATHI'
  | 'GUJARATI'
  | 'PUNJABI'
  | 'HINDI'
  | 'BENGALI'
  | 'ODIA'
  | 'NORTHEAST'
  | 'KASHMIRI'
  | 'GOAN'
  | 'ANGLO'
  | 'PAKISTANI'
  | 'SRI_LANKAN'
  | 'CARIBBEAN'
  | 'BANGLADESHI'
  | 'AFGHAN'
  | 'NEPALI'
  | 'SOUTHERN_AFRICAN';

export const NAME_POOLS: Record<NamePool, { first: string[]; last: string[] }> = {
  TAMIL: {
    first: ['Vignesh', 'Karthik', 'Arun', 'Surya', 'Prakash', 'Senthil', 'Bharath', 'Harish', 'Naveen', 'Sriram', 'Ashwath', 'Gokul', 'Dinesh', 'Mukund', 'Pradeep', 'Ragav', 'Santhosh', 'Tamilarasan', 'Vasanth', 'Yogesh', 'Kishore', 'Madhan', 'Aravind', 'Jagadeesh', 'Elango', 'Karthikeyan', 'Balaji', 'Lokesh', 'Nithish', 'Pranav'],
    last: ['Rajendran', 'Subramanian', 'Murugan', 'Krishnan', 'Venkatesan', 'Sundaram', 'Palanisamy', 'Ramasamy', 'Natarajan', 'Anbalagan', 'Selvaraj', 'Shanmugam', 'Thangavel', 'Arumugam', 'Kannan', 'Periyasamy', 'Govindan', 'Rangarajan', 'Sekar', 'Duraisamy', 'Iyer', 'Srinivasan', 'Gopalan', 'Chandrasekar'],
  },
  KANNADA: {
    first: ['Manjunath', 'Shreyas', 'Prajwal', 'Nagesh', 'Darshan', 'Kiran', 'Chethan', 'Puneeth', 'Sudeep', 'Vinay', 'Abhishek', 'Raghavendra', 'Suhas', 'Varun', 'Tejas', 'Rohith', 'Mahesh', 'Srinidhi'],
    last: ['Gowda', 'Shetty', 'Hegde', 'Bhat', 'Rao', 'Kamath', 'Nayak', 'Kulkarni', 'Patil', 'Shenoy', 'Acharya', 'Murthy', 'Prasad', 'Hebbar', 'Poojary'],
  },
  MALAYALAM: {
    first: ['Arjun', 'Vishnu', 'Akhil', 'Midhun', 'Nithin', 'Sreejith', 'Anand', 'Jithin', 'Rahul', 'Sachin', 'Abhijith', 'Basil', 'Sanju', 'Ajmal', 'Faizal', 'Nikhil', 'Aswin', 'Rohan'],
    last: ['Nair', 'Menon', 'Pillai', 'Kurup', 'Varghese', 'Thomas', 'Mathew', 'Kurian', 'Panicker', 'Warrier', 'Namboothiri', 'Joseph', 'Chacko', 'Rahman', 'Babu'],
  },
  TELUGU: {
    first: ['Srikanth', 'Venkatesh', 'Ravi', 'Chaitanya', 'Harsha', 'Sai', 'Pavan', 'Teja', 'Anudeep', 'Rohit', 'Kalyan', 'Sandeep', 'Vamsi', 'Nikhil', 'Manoj', 'Praneeth', 'Tanmay', 'Yashwanth'],
    last: ['Reddy', 'Naidu', 'Rao', 'Varma', 'Chowdary', 'Raju', 'Goud', 'Yadav', 'Murthy', 'Prasad', 'Setty', 'Kumar', 'Sastry', 'Babu', 'Kishore'],
  },
  MARATHI: {
    first: ['Aditya', 'Omkar', 'Siddhesh', 'Pratik', 'Ruturaj', 'Tushar', 'Nikhil', 'Sahil', 'Swapnil', 'Harshal', 'Mandar', 'Ajinkya', 'Akshay', 'Rohan', 'Chinmay', 'Yash', 'Vaibhav', 'Shardul'],
    last: ['Patil', 'Deshpande', 'Kulkarni', 'Joshi', 'Pawar', 'Jadhav', 'Shinde', 'Gaikwad', 'More', 'Bhosale', 'Sawant', 'Chavan', 'Naik', 'Deshmukh', 'Kadam', 'Salvi'],
  },
  GUJARATI: {
    first: ['Hardik', 'Parth', 'Jay', 'Dhruv', 'Harsh', 'Chirag', 'Kunal', 'Nisarg', 'Jaydev', 'Axar', 'Priyank', 'Vishal', 'Hetvik', 'Karan', 'Darshil', 'Meet'],
    last: ['Patel', 'Shah', 'Mehta', 'Desai', 'Jadeja', 'Parmar', 'Chauhan', 'Solanki', 'Trivedi', 'Pandya', 'Joshi', 'Vaghela', 'Rathod', 'Makwana'],
  },
  PUNJABI: {
    first: ['Gurpreet', 'Harpreet', 'Jaskaran', 'Manpreet', 'Arshdeep', 'Simran', 'Navdeep', 'Prabhsimran', 'Anmol', 'Gurkeerat', 'Sukhjeet', 'Ramandeep', 'Karanveer', 'Taranjit', 'Abhishek', 'Mandeep'],
    last: ['Singh', 'Sandhu', 'Gill', 'Brar', 'Dhillon', 'Sidhu', 'Grewal', 'Bajwa', 'Mann', 'Randhawa', 'Chahal', 'Sekhon', 'Virk', 'Aulakh'],
  },
  HINDI: {
    first: ['Aman', 'Ankit', 'Rahul', 'Vivek', 'Saurabh', 'Priyam', 'Shivam', 'Akash', 'Kuldeep', 'Mohit', 'Nitish', 'Aryan', 'Rinku', 'Harshit', 'Ayush', 'Dhruv', 'Kartik', 'Utkarsh', 'Yuvraj', 'Anuj'],
    last: ['Sharma', 'Verma', 'Yadav', 'Mishra', 'Tiwari', 'Pandey', 'Chauhan', 'Rajput', 'Tyagi', 'Saini', 'Rana', 'Chaudhary', 'Dubey', 'Shukla', 'Gupta', 'Awasthi', 'Negi', 'Bisht'],
  },
  BENGALI: {
    first: ['Abhimanyu', 'Sourav', 'Arnab', 'Sudip', 'Anustup', 'Ritwik', 'Sayan', 'Debopratim', 'Kaushik', 'Shahbaz', 'Akash', 'Pritam', 'Suvankar', 'Rohan', 'Ayan', 'Subhajit'],
    last: ['Das', 'Ghosh', 'Chatterjee', 'Mukherjee', 'Banerjee', 'Bose', 'Sen', 'Dutta', 'Roy', 'Mondal', 'Saha', 'Chakraborty', 'Paul', 'Majumdar'],
  },
  ODIA: {
    first: ['Subhranshu', 'Biplab', 'Sandeep', 'Rajesh', 'Anurag', 'Debasish', 'Govinda', 'Pratyush', 'Kartik', 'Swastik', 'Sumit', 'Ashutosh'],
    last: ['Samantray', 'Mohanty', 'Behera', 'Pradhan', 'Sahoo', 'Nayak', 'Rout', 'Mishra', 'Parida', 'Jena', 'Das', 'Senapati'],
  },
  NORTHEAST: {
    first: ['Rishav', 'Pallavkumar', 'Abhishek', 'Denish', 'Sahil', 'Kishan', 'Bikramjit', 'Lalruat', 'Tenzing', 'Imliwati', 'Chingkhei', 'Bipin', 'Rahul', 'Nilesh'],
    last: ['Das', 'Baruah', 'Gogoi', 'Bora', 'Singha', 'Sharma', 'Tamang', 'Lepcha', 'Longkumer', 'Zomuana', 'Meitei', 'Deb', 'Saikia', 'Hazarika'],
  },
  KASHMIRI: {
    first: ['Umran', 'Abdul', 'Qamran', 'Shubham', 'Auqib', 'Vivrant', 'Musaif', 'Fazil', 'Parvez', 'Yawer', 'Rasikh', 'Henan'],
    last: ['Malik', 'Dar', 'Bhat', 'Wani', 'Mir', 'Lone', 'Sharma', 'Khanday', 'Salam', 'Iqbal', 'Rasool', 'Nabi'],
  },
  GOAN: {
    first: ['Suyash', 'Snehal', 'Darshan', 'Eknath', 'Amogh', 'Lakshay', 'Mohit', 'Felix', 'Shadab', 'Deepraj', 'Heramb', 'Samar'],
    last: ['Prabhudessai', 'Kauthankar', 'Kerkar', 'Naik', 'Gaonkar', 'Fernandes', "D'Souza", 'Rodrigues', 'Parab', 'Sawant', 'Dessai', 'Kamat'],
  },
  ANGLO: {
    first: ['Oliver', 'Jack', 'Harry', 'Charlie', 'Thomas', 'Liam', 'Cooper', 'Mitchell', 'Ethan', 'Finn', 'Sam', 'Lachlan', 'Will', 'Callum', 'Ben', 'Max', 'Ryan', 'Josh'],
    last: ['Clarke', 'Hughes', 'Taylor', 'Walker', 'Mitchell', 'Harris', 'Robinson', 'Wright', 'Turner', 'Campbell', 'Fraser', 'Bennett', 'Murphy', "O'Brien", 'McKay', 'Sutherland', 'Graham', 'Fletcher'],
  },
  PAKISTANI: {
    first: ['Hamza', 'Usman', 'Bilal', 'Faisal', 'Zeeshan', 'Arham', 'Saad', 'Talha', 'Haris', 'Qasim', 'Rizwan', 'Imad', 'Aamir', 'Salman'],
    last: ['Khan', 'Ahmed', 'Qureshi', 'Malik', 'Butt', 'Siddiqui', 'Abbasi', 'Chaudhry', 'Mirza', 'Sheikh', 'Hussain', 'Afridi', 'Raza', 'Nawaz'],
  },
  SRI_LANKAN: {
    first: ['Kasun', 'Dinesh', 'Pathum', 'Charith', 'Dunith', 'Maheesh', 'Sadeera', 'Lahiru', 'Nuwan', 'Tharindu', 'Kamindu', 'Avishka', 'Dilshan', 'Sahan'],
    last: ['Perera', 'Fernando', 'Silva', 'Jayasuriya', 'Wickramasinghe', 'Bandara', 'Rajapaksa', 'Gunawardena', 'Dissanayake', 'Herath', 'Kumara', 'Rathnayake', 'Senanayake'],
  },
  CARIBBEAN: {
    first: ['Shai', 'Alick', 'Jayden', 'Tevin', 'Kjorn', 'Roston', 'Obed', 'Kyle', 'Nathan', 'Jermaine', 'Keacy', 'Andre', 'Romario', 'Joshua'],
    last: ['Joseph', 'Charles', 'Greaves', 'Thomas', 'King', 'Walsh', 'Holder', 'Phillip', 'Mayers', 'Samuels', 'Da Silva', 'Brathwaite', 'Seales', 'Motie'],
  },
  BANGLADESHI: {
    first: ['Tanzid', 'Mahmud', 'Towhid', 'Shoriful', 'Rishad', 'Nahid', 'Parvez', 'Afif', 'Mehedi', 'Zakir', 'Tanvir', 'Rakibul'],
    last: ['Hasan', 'Islam', 'Rahman', 'Hossain', 'Ahmed', 'Uddin', 'Miah', 'Chowdhury', 'Sarkar', 'Karim', 'Alam', 'Shanto'],
  },
  AFGHAN: {
    first: ['Rahmat', 'Ibrahim', 'Azmatullah', 'Fazal', 'Noor', 'Gulbadin', 'Ikram', 'Naveen', 'Hazrat', 'Sediq', 'Wafadar', 'Qais'],
    last: ['Shah', 'Zadran', 'Omarzai', 'Farooqi', 'Ahmad', 'Naib', 'Alikhil', 'Ul-Haq', 'Zazai', 'Atal', 'Momand', 'Safi'],
  },
  NEPALI: {
    first: ['Rohit', 'Kushal', 'Aasif', 'Dipendra', 'Sompal', 'Karan', 'Gulshan', 'Aarif', 'Pratis', 'Kamal', 'Bibek', 'Anil'],
    last: ['Paudel', 'Bhurtel', 'Airee', 'Kami', 'Malla', 'Jha', 'Sheikh', 'Shah', 'Sah', 'Yadav', 'Kharel', 'Thapa'],
  },
  SOUTHERN_AFRICAN: {
    first: ['Sikandar', 'Brian', 'Tendai', 'Blessing', 'Wessly', 'Tadiwa', 'Gerhard', 'JJ', 'Ruben', 'Jan', 'Bernard', 'Nicol'],
    last: ['Raza', 'Bennett', 'Chatara', 'Muzarabani', 'Madhevere', 'Erasmus', 'Smit', 'Trumpelmann', 'Loftie-Eaton', 'Scholtz', 'Frylinck', 'Masakadza'],
  },
};

/** Which pool a state's (or nation's) players come from. */
export const POOL_BY_STATE: Record<string, NamePool> = {
  'Tamil Nadu': 'TAMIL',
  Puducherry: 'TAMIL',
  Karnataka: 'KANNADA',
  Kerala: 'MALAYALAM',
  'Andhra Pradesh': 'TELUGU',
  Telangana: 'TELUGU',
  Goa: 'GOAN',
  Maharashtra: 'MARATHI',
  Gujarat: 'GUJARATI',
  Punjab: 'PUNJABI',
  Haryana: 'HINDI',
  Delhi: 'HINDI',
  'Himachal Pradesh': 'HINDI',
  'Jammu and Kashmir': 'KASHMIRI',
  Rajasthan: 'HINDI',
  'Madhya Pradesh': 'HINDI',
  'Uttar Pradesh': 'HINDI',
  Uttarakhand: 'HINDI',
  Bihar: 'HINDI',
  Jharkhand: 'HINDI',
  Chhattisgarh: 'HINDI',
  'West Bengal': 'BENGALI',
  Odisha: 'ODIA',
  Assam: 'NORTHEAST',
  Australia: 'ANGLO',
  England: 'ANGLO',
  'New Zealand': 'ANGLO',
  Ireland: 'ANGLO',
  Scotland: 'ANGLO',
  'United States': 'ANGLO',
  'South Africa': 'SOUTHERN_AFRICAN',
  Zimbabwe: 'SOUTHERN_AFRICAN',
  Pakistan: 'PAKISTANI',
  'United Arab Emirates': 'PAKISTANI',
  'Sri Lanka': 'SRI_LANKAN',
  'West Indies': 'CARIBBEAN',
  Bangladesh: 'BANGLADESHI',
  Afghanistan: 'AFGHAN',
  Nepal: 'NEPALI',
};

/** Real, famous players a random pairing must never reproduce. */
export const FAMOUS = new Set([
  'Rohit Sharma',
  'Ishant Sharma',
  'Mohit Sharma',
  'Rahul Sharma',
  'Karn Sharma',
  'Abhishek Sharma',
  'Kuldeep Yadav',
  'Umesh Yadav',
  'Hardik Pandya',
  'Axar Patel',
  'Parthiv Patel',
  'Karun Nair',
  'Dinesh Karthik',
  'Mayank Agarwal',
  'Shreyas Iyer',
  'Venkatesh Iyer',
  'Sanju Samson',
  'Sachin Baby',
  'Nitish Rana',
  'Arshdeep Singh',
  'Shubman Gill',
  'Harbhajan Singh',
  'Yuvraj Singh',
  'Umran Malik',
  'Abdul Samad',
  'Rinku Singh',
  'Sourav Ghosh',
  'Shahbaz Ahmed',
  'Riyan Parag',
  'Ruturaj Gaikwad',
  'Ajinkya Rahane',
  'Shardul Thakur',
  'Vijay Shankar',
  'Washington Sundar',
  'Sai Kishore',
  'Sai Sudharsan',
  'Rahul Tewatia',
  'Jaydev Unadkat',
  'Kasun Rajitha',
  'Pathum Nissanka',
  'Rahmat Shah',
  'Ibrahim Zadran',
  'Azmatullah Omarzai',
  'Fazal Farooqi',
  'Naveen Ul-Haq',
  'Rohit Paudel',
  'Kushal Bhurtel',
  'Sikandar Raza',
  'Blessing Muzarabani',
  'Shai Hope',
  'Alick Athanaze',
  'Tanzid Hasan',
  'Towhid Hridoy',
  'Mehedi Hasan',
  'Sam Curran',
]);
