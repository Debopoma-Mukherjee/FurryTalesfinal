const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix);
  }
});

const upload = multer({ storage: storage });
const app = express();
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

const port = 4000;

const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017');

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  likedPets: [{type:mongoose.Schema.Types.ObjectId, ref: 'Pets'}],
  addresses: [{ street: String, city: String, country: String }],
  cart: [String], // Store cart item IDs as strings
  cardEntries: [{
    cardNumber: String,
    cardHolder: String,
    expiryDate: String,
    cvv: String
  }],
  orders: [{
    orderNumber: Number,
    items: [String], // Store item IDs as strings
    createdAt: { type: Date, default: Date.now }
  }]
});


const Users = mongoose.model('Users', userSchema);

const schema = new mongoose.Schema({
  pname: String,
  pdesc: String,
  price: String,
  category: String,
  contactNumber: String,
  pimage: String,
  addedBy: String,
});

const Pets = mongoose.model('Pets', schema);



app.get('/', (req, res) => {
  res.send('Hello World!');
});


app.post('/like-pet', (req, res) => {
  let { petId, userId } = req.body;

  console.log(req.body);

  Users.updateOne({ _id: userId }, { $addToSet: { likedPets: petId } })
    .then(() => {
      res.send({ message: 'liked success.' });
    })
    .catch(() => {
      res.send({ message: 'server err' });
    });
});

app.post('/liked-pets', (req,res) => {
  Users.findOne({ _id: req.body.userId }).populate('likedPets')
  .then((result) => {
      res.send({ message: 'success', pets: result.likedPets })
  })
  .catch((err) => {
      res.send({ message: 'server err' })
  })
});

app.post('/my-pets', (req,res) => {
  const userId = req.body.userId;

  Pets.find({ addedBy: userId })
      .then((result) => {
          res.send({ message: 'success', pets: result })
      })
      .catch((err) => {
          res.send({ message: 'server err' })
      })

});

app.post('/remove-pet', (req, res) => {
  const { petId } = req.body;

  Pets.findByIdAndDelete(petId)
    .then((removedPet) => {
      if (!removedPet) {
        return res.status(404).send({ message: 'Pet not found.' });
      }
      res.send({ message: 'Pet removed successfully.' });
    })
    .catch((error) => {
      console.error('Error removing pet:', error);
      res.status(500).send({ message: 'Server error' });
    });
});


app.post('/remove-from-wishlist', (req, res) => {
  const { petId, userId } = req.body;

  Users.updateOne({ _id: userId }, { $pull: { likedPets: petId } })
    .then(() => {
      res.send({ message: 'Pet removed from wishlist successfully.' });
    })
    .catch((error) => {
      console.error('Error removing pet from wishlist:', error);
      res.status(500).send({ message: 'Server error' });
    });
});



app.post('/add-address', async (req, res) => {
  const { street, city, country } = req.body;
  const token = req.headers.authorization.split(' ')[1];
  try {
    const decoded = jwt.verify(token, 'MYSECRETKEY');
    const userId = decoded.userId;
    const user = await Users.findById(userId);
    if (!user) {
      return res.status(404).send({ message: 'User not found' });
    }
    user.addresses.push({ street, city, country });
    await user.save();
    res.send({ message: 'Address added successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Server error' });
  }
});

app.post('/add-to-cart/:productId', async (req, res) => {
  const token = req.headers.authorization.split(' ')[1];
  const { productId } = req.params;

  try {
    const decoded = jwt.verify(token, 'MYSECRETKEY');
    const userId = decoded.userId;

    const user = await Users.findById(userId);
    if (!user) {
      return res.status(404).send({ message: 'User not found' });
    }

    if (typeof productId !== 'string') {
      return res.status(400).send({ message: 'Invalid product ID' });
    }

    user.cart.push(productId);
    await user.save();
    res.send({ message: 'Product added to cart successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Server error' });
  }
});
app.post('/move-to-orders', async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, 'MYSECRETKEY');
    const userId = decoded.userId;

    const user = await Users.findById(userId);
    if (!user) {
      return res.status(404).send({ message: 'User not found' });
    }

    // Directly push cart item IDs as strings to orders array
    const orderNumber = user.orders.length + 1;
    user.orders.push({ orderNumber, items: user.cart }); // Use cart item IDs directly
    await user.save();

    // Clear cart after moving items to orders
    user.cart = [];
    await user.save();

    console.log('Cart items moved to orders successfully');
    res.send({ message: 'Items moved to orders successfully' });
  } catch (error) {
    console.error('Error moving cart items to orders:', error);
    res.status(500).send({ message: 'Server error' });
  }
});




app.get('/get-addresses', async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, 'MYSECRETKEY');
    const userId = decoded.userId;
    const user = await Users.findById(userId);
    if (!user) {
      return res.status(404).send({ message: 'User not found' });
    }
    res.send({ addresses: user.addresses });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Server error' });
  }
});

app.post('/add-pet', upload.single('pimage'), function (req, res) {
  console.log(req.file, req.body);
  const { pname, pdesc, price, category, contactNumber } = req.body;
  const addedBy = req.body.userId;
  const pimage = req.file.path;

  const pet = new Pets({ pname, pdesc, price, category, pimage, contactNumber, addedBy });
  pet.save()
    .then(() => {
      res.send({ message: 'Pet saved successfully' });
    })
    .catch((error) => {
      console.error(error);
      res.status(500).send({ message: 'Server error' });
    });
});

app.get('/get-pets', (req, res) => {
  Pets.find()
    .then((result) => {
      console.log(result, "user data");
      res.send({ message: 'success', pets: result });
    })
    .catch((err) => {
      res.send({ message: 'server err' });
    });
});

app.get('/get-cart', async (req, res) => {
  const token = req.headers.authorization.split(' ')[1];
  try {
    const decoded = jwt.verify(token, 'MYSECRETKEY');
    const userId = decoded.userId;
    const user = await Users.findById(userId).populate('cart');
    if (!user) {
      return res.status(404).send({ message: 'User not found' });
    }
    res.send({ cart: user.cart });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Server error' });
  }
});

app.get('/get-pet/:id', (req, res) => {
  console.log(req.params);
  Pets.findOne({ _id: req.params.id })
    .then((result) => {
      console.log(result, "user data");
      res.send({ message: 'success', pet: result });
    })
    .catch((err) => {
      res.send({ message: 'server err' });
    });
});


const emailValidator = require("email-validator");

app.post('/signup', async (req, res) => {
    const { email, password } = req.body;
    try {
        // Check if the email is in the correct format
        if (!emailValidator.validate(email)) {
            return res.status(400).send({ message: 'Invalid email format' });
        }

        // Check if the email already exists
        const existingUser = await Users.findOne({ username: email });
        if (existingUser) {
            return res.status(400).send({ message: 'Email already exists' });
        }

        // If email doesn't exist and is in the correct format, hash the password and save the user
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new Users({ username: email, password: hashedPassword });
        await user.save();
        res.send({ message: 'Saved successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: 'Server error' });
    }
});




app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await Users.findOne({ username: username });
    if (!user) {
      return res.status(400).send({ message: 'User not found.' });
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).send({ message: 'Password wrong.' });
    }
    const token = jwt.sign({ userId: user._id }, 'MYSECRETKEY', { expiresIn: '10000h' });
    res.send({ message: 'Login success.', token: token, userId: user._id });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Server err' });
  }
});

app.get('/get-user', async (req, res) => {
  const token = req.headers.authorization.split(' ')[1];
  try {
    const decoded = jwt.verify(token, 'MYSECRETKEY');
    const userId = decoded.userId;
    const user = await Users.findById(userId);
    if (!user) {
      return res.status(404).send({ message: 'User not found' });
    }
    res.send({ email: user.username });
  } catch (error) {
    console.error(error);
    res.status(401).send({ message: 'Unauthorized' });
  }
});

app.delete('/empty-cart', async (req, res) => {
  console.log('DELETE request received at /empty-cart');
  const token = req.headers.authorization.split(' ')[1];
  try {
    const decoded = jwt.verify(token, 'MYSECRETKEY');
    const userId = decoded.userId;

    const user = await Users.findById(userId);
    if (!user) {
      return res.status(404).send({ message: 'User not found' });
    }

    user.cart = [];
    await user.save();

    res.send({ message: 'Cart emptied successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Server error' });
  }
});

app.post('/save-card-details', async (req, res) => {
  const { cardNumber, cardHolder, expiryDate, cvv } = req.body;
  try {
    // Check if the authorization header exists
    if (!req.headers.authorization) {
      return res.status(401).send({ message: 'Unauthorized' });
    }
    
    // Split the authorization header to extract the token
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, 'MYSECRETKEY');
    const userId = decoded.userId;

    const user = await Users.findById(userId);
    if (!user) {
      return res.status(404).send({ message: 'User not found' });
    }

    // Create a new card entry for the user
    user.cardEntries.push({ cardNumber, cardHolder, expiryDate, cvv });
    await user.save();

    console.log("Card details saved successfully");
    res.send({ message: 'Card details saved successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Server error' });
  }
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
