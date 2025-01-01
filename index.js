const express = require('express')
const app = express()
const cors = require('cors')
const mongodb = require('mongoose')
const req = require('express/lib/request')
require('dotenv').config()

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static('public'))

const apiRouter = express.Router()

// connect database
;(async function(){
  await mongodb.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected.'))
  .catch(err => console.log(`Error connecting MongoDB: %s`, err));
})();

// models
const User = mongodb.model('User', new mongodb.Schema({
  username: {
    type: mongodb.Schema.Types.String,
    required: true,
    unique: true,
  }
}, { versionKey: false }));

const Exercise = mongodb.model('Exercise', new mongodb.Schema({
  username: {
    type: mongodb.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  description: mongodb.Schema.Types.String,
  date: mongodb.Schema.Types.Date,
  duration: mongodb.Schema.Types.Int32,
}, { versionKey: false }));



app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

// APIs
apiRouter.post('/users', async (req, res) => {
  try {
    const { username } = req.body;
    // console.log('Username: %s', username)
    const usr = new User({ username })
    await usr.save().catch(err => {
      throw err
    })
    console.log('User CREATED? :: ', usr)
    return res.status(201).json(usr)
  } catch(err) {
    return res.status(400).json({error: err})
  }
});

apiRouter.get('/users', async (req, res) => {
  const users = await User.find({});
  return res.json(users);
});

apiRouter.post('/users/:id/exercises', async (req, res) => {
  let { description, duration, date } = req.body;
  if (!date) date = new Date();

  return await new Exercise({
    description,
    duration,
    date,
    username: req.params.id,
  }).save()
  .then(async (doc) => {
    const usr = await User.findById(req.params.id)
    const nestedDoc = (await doc.populate('username')).toJSON()
    return res.status(201).json({
      ...nestedDoc,
      ...usr.toJSON(),
      username: nestedDoc.username.username,
      date: nestedDoc.date.toDateString(),
    })
  })
  .catch(err => res.status(400).json({error: err}))
});

apiRouter.get('/users/:id/logs', async(req, res) => {
  const { id } = req.params;
  const { from, to, limit } = req.query;
  const usr = await User.findById(id);
  if (!usr) return res.status(404).json({error: 'User not found'});

  const query = { username: id };
  if (from || to) {
    query.date = {};
    if (from) query.date.$gte = new Date(from);
    if (to) query.date.$lte = new Date(to);
  }

  // load exercises as logs
  const exercises = await Exercise.find(query)
    .select('description duration date -_id')
    .limit(parseInt(limit, 10) || 0);

  let logs = {
    count: exercises.length,
    log: exercises.map(exr => {
      return {
        ...exr.toJSON(),
        date: exr.date.toDateString(),
      }
    }),
  }

  return res.json({ ...usr.toJSON(), ...logs });
});



// API Routers
app.use('/api', apiRouter)



const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
