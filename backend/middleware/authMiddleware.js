const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Admin = require('../models/Admin');

const verifyToken = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Try finding user in Admin collection first
      req.user = await Admin.findById(decoded.id).select('-password');
      
      // If not found in Admin, they might be a promoted admin in User collection, or a standard user
      if (!req.user) {
        req.user = await User.findById(decoded.id).select('-password');
      }
      
      if (!req.user) {
        return res.status(401).json({ message: 'Not authorized, user not found' });
      }

      // Self-heal presidentOf sync issues
      if (req.user.role === 'president' && !req.user.presidentOf) {
        const Club = require('../models/Club');
        const club = await Club.findOne({ president: req.user._id });
        if (club) {
          req.user.presidentOf = club._id;
          if (typeof req.user.save === 'function') {
             await req.user.save();
          }
        }
      }
      
      // If user is banned, prevent access
      if (req.user.status === 'banned') {
        return res.status(403).json({ message: 'Your account has been banned' });
      }

      next();
    } catch (error) {
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

const authorizeRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: `Role ${req.user ? req.user.role : 'unknown'} is not authorized to access this route` });
    }
    next();
  };
};

const requirePresident = async (req, res, next) => {
  if (req.user.role !== 'president') {
    return res.status(403).json({ message: 'Not authorized as president' });
  }

  const actOnClubId = req.params.clubId || req.body.clubId;
  
  if (actOnClubId) {
    const isAuthorized = req.user.presidentOf && req.user.presidentOf.toString() === actOnClubId;
    if (!isAuthorized) {
      const Club = require('../models/Club');
      const club = await Club.findById(actOnClubId);
      if (!club || club.president.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to perform actions for this club' });
      }
    }
  }
  
  next();
};

module.exports = { verifyToken, authorizeRole, requirePresident };
