import { body, validationResult } from 'express-validator';

// Validation middleware
export const validateBooking = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2 })
    .withMessage('Name must be at least 2 characters')
    .custom((value) => {
      console.log('👤 Validating name:', value);
      return true;
    }),
  
  body('mobile')
    .trim()
    .notEmpty()
    .withMessage('Mobile number is required')
    .custom((value) => {
      console.log('📱 Validating mobile:', value);
      if (!value.match(/^\+\d{1,4}\d{6,14}$/)) {
        throw new Error('Enter valid mobile number with country code (format: +XX1234567890)');
      }
      return true;
    }),
  
  body('pickup')
    .trim()
    .notEmpty()
    .withMessage('Pickup location is required')
    .custom((value) => {
      console.log('📍 Validating pickup:', value);
      return true;
    }),
  
  body('drop')
    .trim()
    .notEmpty()
    .withMessage('Drop location is required')
    .custom((value) => {
      console.log('🎯 Validating drop:', value);
      return true;
    }),
  
  body('tripType')
    .isIn(['oneway', 'round'])
    .withMessage('Trip type must be either oneway or round')
    .custom((value) => {
      console.log('🔄 Validating tripType:', value);
      return true;
    }),
  
  body('cabType')
    .isIn(['sedan', 'etios', 'suv', 'innova'])
    .withMessage('Invalid cab type')
    .custom((value) => {
      console.log('🚗 Validating cabType:', value);
      return true;
    }),
  
  body('distance')
    .custom((value) => {
      console.log('📏 Validating distance:', value, 'type:', typeof value);
      if (value === undefined || value === null || value === '') {
        throw new Error('Distance is required');
      }
      const numValue = Number(value);
      if (isNaN(numValue)) {
        throw new Error('Distance must be a number');
      }
      if (numValue < 1) {
        throw new Error('Distance must be at least 1 km');
      }
      return true;
    }),
  
  body('estimatedFare')
    .optional()
    .custom((value) => {
      if (value !== undefined && value !== null && value !== '') {
        console.log('💰 Validating estimatedFare:', value);
        const numValue = Number(value);
        if (isNaN(numValue)) {
          throw new Error('Estimated fare must be a number');
        }
      }
      return true;
    }),
];

// Error handling middleware
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorDetails = errors.array();
    console.warn('❌ Validation failed:');
    errorDetails.forEach(err => {
      console.warn(`  Field "${err.path}": ${err.msg}`);
    });
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errorDetails.map(err => ({
        field: err.path,
        message: err.msg,
      })),
    });
  }
  console.log('✅ Validation passed for all fields');
  next();
};
