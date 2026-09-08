const mongoose = require('mongoose');

const ideaSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true
  },
  topic: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  status: {
    type: String,
    default: 'pending',
    enum: ['pending', 'posted', 'rejected']
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  posted_at: {
    type: Date
  }
});

const Idea = mongoose.model('Idea', ideaSchema);

async function initDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Database connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
}

async function saveIdea(content, topic, category) {
  try {
    const idea = new Idea({
      content,
      topic,
      category,
      status: 'pending'
    });
    await idea.save();
    return idea._id;
  } catch (error) {
    console.error('Error saving idea:', error);
    throw error;
  }
}

async function getPreviousTopics() {
  try {
    const ideas = await Idea.find({
      status: { $in: ['posted', 'rejected'] }
    })
    .select('topic')
    .sort({ created_at: -1 })
    .limit(20)
    .distinct('topic');
    
    return ideas;
  } catch (error) {
    console.error('Error getting previous topics:', error);
    return [];
  }
}

async function getNextCategory() {
  try {
    const categories = ['physical', 'service', 'digital', 'eco', 'food', 'skills'];
    
    const lastIdea = await Idea.findOne()
      .sort({ created_at: -1 })
      .select('category');
    
    if (!lastIdea) {
      return categories[0];
    }
    
    const currentIndex = categories.indexOf(lastIdea.category);
    const nextIndex = (currentIndex + 1) % categories.length;
    return categories[nextIndex];
  } catch (error) {
    console.error('Error getting next category:', error);
    return 'physical';
  }
}

async function markPosted(id) {
  try {
    await Idea.findByIdAndUpdate(id, {
      status: 'posted',
      posted_at: new Date()
    });
  } catch (error) {
    console.error('Error marking idea as posted:', error);
    throw error;
  }
}

async function markRejected(id) {
  try {
    await Idea.findByIdAndUpdate(id, {
      status: 'rejected'
    });
  } catch (error) {
    console.error('Error marking idea as rejected:', error);
    throw error;
  }
}

async function getAllIdeas() {
  try {
    const ideas = await Idea.find()
      .sort({ created_at: -1 })
      .lean();
    return ideas;
  } catch (error) {
    console.error('Error getting all ideas:', error);
    return [];
  }
}

async function getStats() {
  try {
    const stats = await Idea.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          posted: {
            $sum: { $cond: [{ $eq: ['$status', 'posted'] }, 1, 0] }
          },
          rejected: {
            $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
          },
          pending: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          }
        }
      }
    ]);
    
    if (stats.length === 0) {
      return { total: 0, posted: 0, rejected: 0, pending: 0 };
    }
    
    return {
      total: stats[0].total,
      posted: stats[0].posted,
      rejected: stats[0].rejected,
      pending: stats[0].pending
    };
  } catch (error) {
    console.error('Error getting stats:', error);
    return { total: 0, posted: 0, rejected: 0, pending: 0 };
  }
}

async function getIdeaById(id) {
  try {
    const idea = await Idea.findById(id).lean();
    return idea;
  } catch (error) {
    console.error('Error getting idea by id:', error);
    return null;
  }
}

module.exports = {
  initDB,
  saveIdea,
  getPreviousTopics,
  getNextCategory,
  markPosted,
  markRejected,
  getAllIdeas,
  getStats,
  getIdeaById
};
