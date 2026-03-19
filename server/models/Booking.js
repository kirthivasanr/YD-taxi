import mongoose from 'mongoose';

// Helper function to generate booking reference
const generateBookingRef = () => {
  const prefix = 'YD';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${timestamp}${random}`;
};

const bookingSchema = new mongoose.Schema(
  {
    bookingRef: {
      type: String,
      unique: true,
      required: true,
      default: generateBookingRef,
    },
    tripType: {
      type: String,
      enum: ['oneway', 'round'],
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    mobile: {
      type: String,
      required: true,
      trim: true,
    },
    pickup: {
      type: String,
      required: true,
      trim: true,
    },
    drop: {
      type: String,
      required: true,
      trim: true,
    },
    cabType: {
      type: String,
      enum: ['sedan', 'etios', 'suv', 'innova'],
      required: true,
    },
    distance: {
      type: Number,
      required: true,
      min: 1,
    },
    date: String,
    time: String,
    startDate: String,
    startTime: String,
    returnDate: String,
    returnTime: String,
    estimatedFare: Number,
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'completed', 'cancelled'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

const Booking = mongoose.model('Booking', bookingSchema);

export default Booking;
