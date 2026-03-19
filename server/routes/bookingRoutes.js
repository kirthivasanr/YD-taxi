import express from 'express';
import Booking from '../models/Booking.js';
import { validateBooking, handleValidationErrors } from '../middleware/validation.js';
import { bookingLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Create a new booking
router.post('/', bookingLimiter, validateBooking, handleValidationErrors, async (req, res) => {
  try {
    console.log('📝 Received booking request:', req.body);
    const booking = new Booking(req.body);
    const savedBooking = await booking.save();
    console.log('✅ Booking saved successfully:', savedBooking);
    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      booking: savedBooking,
    });
  } catch (error) {
    console.error('❌ Booking error:', error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

// Get all bookings
router.get('/', async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      count: bookings.length,
      bookings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Get booking by ID
router.get('/:id', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }
    res.json({
      success: true,
      booking,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Update booking status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }
    res.json({
      success: true,
      message: 'Booking status updated',
      booking,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

// Delete booking
router.delete('/:id', async (req, res) => {
  try {
    const booking = await Booking.findByIdAndDelete(req.params.id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }
    res.json({
      success: true,
      message: 'Booking deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
