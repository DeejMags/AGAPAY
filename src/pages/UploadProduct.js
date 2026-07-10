import React, { useState, useEffect, useCallback } from 'react'
import { postProduct } from '../firebaseProductService'
import { auth } from '../firebase'

export default function UploadProduct(){
  const [isRecyclable, setIsRecyclable] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  // Recyclable-specific fields
  const [recyclableCategories, setRecyclableCategories] = useState([])
  const [recyclableCategoryKey, setRecyclableCategoryKey] = useState('')
  const [recyclableTypeKey, setRecyclableTypeKey] = useState('')
  const [weight, setWeight] = useState('')
  const [numberOfSacks, setNumberOfSacks] = useState('')
  const [deliveryMethod, setDeliveryMethod] = useState('dropoff')
  const [pickupAddress, setPickupAddress] = useState('')
  const [pickupDate, setPickupDate] = useState('')
  const [pickupTime, setPickupTime] = useState('')
  const [transportationFee, setTransportationFee] = useState('0')
  const [estimatedMinEarnings, setEstimatedMinEarnings] = useState(null)
  const [estimatedMaxEarnings, setEstimatedMaxEarnings] = useState(null)
  const [estimatedNetPayment, setEstimatedNetPayment] = useState(null)
  const [nonAcceptableWarningAccepted, setNonAcceptableWarningAccepted] = useState(false)

  const [loadingCategories, setLoadingCategories] = useState(false)

  const NON_ACCEPTABLE_ITEMS = [
    'Hazardous Chemicals',
    'Medical Waste',
    'Explosives',
    'Leaking Batteries',
    'Flammable Materials',
    'Contaminated Waste',
  ]

  // Fetch recyclable categories on mount
  useEffect(() => {
    if (isRecyclable) {
      fetchRecyclableCategories()
    }
  }, [isRecyclable])

  const fetchRecyclableCategories = async () => {
    try {
      setLoadingCategories(true)
      const response = await fetch('/api/products/recyclables/categories')
      if (!response.ok) throw new Error('Failed to fetch categories')
      const data = await response.json()
      setRecyclableCategories(data.categories || [])
    } catch (err) {
      console.error('Error fetching recyclable categories:', err)
    } finally {
      setLoadingCategories(false)
    }
  }

  // Calculate estimated earnings when weight or category/type changes
  const calculateEarnings = useCallback(async () => {
    try {
      const response = await fetch('/api/products/recyclables/calculate-earnings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryKey: recyclableCategoryKey,
          typeKey: recyclableTypeKey,
          weight: parseFloat(weight),
          transportationFee: parseFloat(transportationFee || 0),
        }),
      })
      if (!response.ok) throw new Error('Failed to calculate earnings')
      const data = await response.json()
      setEstimatedMinEarnings(data.estimatedMinEarnings)
      setEstimatedMaxEarnings(data.estimatedMaxEarnings)
      setEstimatedNetPayment({
        min: data.estimatedNetMin,
        max: data.estimatedNetMax,
      })
    } catch (err) {
      console.error('Error calculating earnings:', err)
    }
  }, [recyclableCategoryKey, recyclableTypeKey, weight, transportationFee])

  // Calculate estimated earnings when weight or category/type changes
  useEffect(() => {
    if (isRecyclable && recyclableCategoryKey && recyclableTypeKey && weight) {
      calculateEarnings()
    } else if (!isRecyclable || !weight) {
      setEstimatedMinEarnings(null)
      setEstimatedMaxEarnings(null)
      setEstimatedNetPayment(null)
    }
  }, [recyclableCategoryKey, recyclableTypeKey, weight, transportationFee, isRecyclable, calculateEarnings])

  function onFileChange(e){
    const file = e.target.files[0]
    if(!file) return
    
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target.result)
    reader.readAsDataURL(file)
  }

  const submit = async e => {
    e.preventDefault()
    const user = JSON.parse(localStorage.getItem('user') || 'null')
    const errs = {};
    
    if (!user) errs.user = 'Login required';
    if (!title || !title.trim()) errs.title = 'Title is required';
    if (!imageFile) errs.image = 'Image is required';

    if (isRecyclable) {
      if (!recyclableCategoryKey) errs.recyclableCategoryKey = 'Recyclable category is required';
      if (!recyclableTypeKey) errs.recyclableTypeKey = 'Recyclable type is required';
      if (!weight || weight <= 0) errs.weight = 'Weight must be a positive number';
      if (!numberOfSacks || numberOfSacks <= 0) errs.numberOfSacks = 'Number of sacks must be at least 1';
      if (deliveryMethod === 'pickup') {
        if (!pickupAddress) errs.pickupAddress = 'Pickup address is required';
        if (!pickupDate) errs.pickupDate = 'Pickup date is required';
        if (!pickupTime) errs.pickupTime = 'Pickup time is required';
      }
      if (!nonAcceptableWarningAccepted) errs.nonAcceptableWarning = 'You must acknowledge non-acceptable items';
    } else {
      if (!price) errs.price = 'Please select a price';
      if (!category) errs.category = 'Category is required';
    }

    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true)
    try {
      const firebaseUser = auth.currentUser;
      const productData = {
        title,
        description,
        category: isRecyclable ? null : category,
        status: 'pending',
        sellerId: (firebaseUser && firebaseUser.uid) || (user && user.id) || '',
        sellerName: (user && (user.username || user.name)) || (firebaseUser && (firebaseUser.displayName || '')) || 'Unknown Seller',
        
        // Recyclable fields
        isRecyclable: isRecyclable,
        recyclableCategoryKey: isRecyclable ? recyclableCategoryKey : null,
        recyclableTypeKey: isRecyclable ? recyclableTypeKey : null,
        weight: isRecyclable ? parseFloat(weight) : null,
        numberOfSacks: isRecyclable ? parseInt(numberOfSacks, 10) : null,
        deliveryMethod: isRecyclable ? deliveryMethod : null,
        pickupAddress: isRecyclable && deliveryMethod === 'pickup' ? pickupAddress : null,
        pickupDate: isRecyclable && deliveryMethod === 'pickup' ? pickupDate : null,
        pickupTime: isRecyclable && deliveryMethod === 'pickup' ? pickupTime : null,
        transportationFee: isRecyclable && deliveryMethod === 'pickup' ? parseFloat(transportationFee || 0) : 0,
        estimatedMinEarnings: isRecyclable ? estimatedMinEarnings : (price !== '' ? parseFloat(price) : null),
        estimatedMaxEarnings: isRecyclable ? estimatedMaxEarnings : null,
        estimatedNetPayment: isRecyclable ? (estimatedNetPayment ? Math.round((estimatedNetPayment.min + estimatedNetPayment.max) / 2 * 100) / 100 : null) : null,
        nonAcceptableItemsWarningAccepted: isRecyclable ? nonAcceptableWarningAccepted : false,
        
        // For regular products, use price field
        price: !isRecyclable && price !== '' ? parseFloat(price) : null,
      }

      await postProduct(productData, imageFile)
      alert('Product uploaded successfully! It will appear in marketplace after admin approval.')
      window.location.href = '/marketplace'
    } catch (error) {
      console.error('Upload error:', error)
      alert('Failed to upload product: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const currentCategory = recyclableCategories.find(c => c.key === recyclableCategoryKey)

  return (
    <div className="py-6 sm:py-8 container mx-auto px-3 sm:px-4 max-w-2xl">
      <h1 className="text-2xl sm:text-3xl font-bold">Upload Product</h1>
      
      {/* Product Type Selector */}
      <div className="mt-6 flex gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input 
            type="radio" 
            checked={!isRecyclable} 
            onChange={() => {
              setIsRecyclable(false)
              setErrors({})
            }} 
          />
          <span>Regular Product</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input 
            type="radio" 
            checked={isRecyclable} 
            onChange={() => {
              setIsRecyclable(true)
              setErrors({})
            }} 
          />
          <span>Recyclable Material</span>
        </label>
      </div>

      <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
        {/* Common Fields */}
        <input 
          value={title} 
          onChange={e=>setTitle(e.target.value)} 
          placeholder={isRecyclable ? "e.g., Plastic Bottles, Scrap Metal" : "Product title"} 
          className="p-3 border rounded text-base min-h-[44px]" 
          required 
        />
        {errors.title && <div className="text-red-500 text-sm">{errors.title}</div>}

        <textarea 
          value={description} 
          onChange={e=>setDescription(e.target.value)} 
          placeholder="Description (optional)" 
          className="p-3 border rounded text-base min-h-[100px]" 
        />

        {/* Regular Product Fields */}
        {!isRecyclable && (
          <>
            {/* Price Selection - Button Based */}
            <div>
              <label className="block text-sm font-medium mb-2">Select Price Range</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[100, 500, 1000, 2000, 5000, 10000].map(priceOption => (
                  <button
                    key={priceOption}
                    type="button"
                    onClick={() => setPrice(String(priceOption))}
                    className={`p-3 border-2 rounded font-semibold transition ${
                      price === String(priceOption)
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    ₱{priceOption.toLocaleString()}
                  </button>
                ))}
              </div>
              {price && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
                  Selected Price: <span className="font-bold">₱{Number(price).toLocaleString()}</span>
                </div>
              )}
              {errors.price && <div className="text-red-500 text-sm mt-2">{errors.price}</div>}
            </div>

            <select 
              value={category} 
              onChange={e=>setCategory(e.target.value)} 
              className="p-3 border rounded text-base min-h-[44px]"
            >
              <option value="">Select category</option>
              <option value="metals">Metals</option>
              <option value="plastics">Plastics</option>
              <option value="paper">Paper</option>
              <option value="card board">Card Board</option>
              <option value="electronics">Electronics</option>
              <option value="others">Others</option>
            </select>
          </>
        )}

        {/* Recyclable Product Fields */}
        {isRecyclable && (
          <>
            {/* Category and Type Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Recyclable Category</label>
                <select 
                  value={recyclableCategoryKey} 
                  onChange={e => {
                    setRecyclableCategoryKey(e.target.value)
                    setRecyclableTypeKey('')
                  }}
                  className="w-full p-3 border rounded"
                >
                  <option value="">Select category</option>
                  {recyclableCategories.map(cat => (
                    <option key={cat.key} value={cat.key}>{cat.name}</option>
                  ))}
                </select>
                {errors.recyclableCategoryKey && <div className="text-red-500 text-xs mt-1">{errors.recyclableCategoryKey}</div>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Recyclable Type</label>
                <select 
                  value={recyclableTypeKey} 
                  onChange={e => setRecyclableTypeKey(e.target.value)}
                  disabled={!currentCategory}
                  className="w-full p-3 border rounded disabled:bg-gray-100"
                >
                  <option value="">Select type</option>
                  {currentCategory && currentCategory.types.map(type => (
                    <option key={type.key} value={type.key}>
                      {type.name} (₱{type.priceMin}-₱{type.priceMax}/kg)
                    </option>
                  ))}
                </select>
                {errors.recyclableTypeKey && <div className="text-red-500 text-xs mt-1">{errors.recyclableTypeKey}</div>}
              </div>
            </div>

            {/* Weight and Sacks */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Weight (kg)</label>
                <input 
                  value={weight} 
                  onChange={e => setWeight(e.target.value)} 
                  type="number" 
                  step="0.1" 
                  placeholder="0.0"
                  className="w-full p-3 border rounded"
                />
                {errors.weight && <div className="text-red-500 text-xs mt-1">{errors.weight}</div>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Number of Sacks</label>
                <input 
                  value={numberOfSacks} 
                  onChange={e => setNumberOfSacks(e.target.value)} 
                  type="number" 
                  min="1"
                  placeholder="1"
                  className="w-full p-3 border rounded"
                />
                {errors.numberOfSacks && <div className="text-red-500 text-xs mt-1">{errors.numberOfSacks}</div>}
              </div>
            </div>

            {/* Estimated Earnings Display */}
            {estimatedMinEarnings !== null && (
              <div className="bg-green-50 border border-green-200 rounded p-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-xs text-gray-600">Estimated Earnings</div>
                    <div className="text-lg font-semibold text-green-700">₱{estimatedMinEarnings.toFixed(2)} - ₱{estimatedMaxEarnings.toFixed(2)}</div>
                  </div>
                  {deliveryMethod === 'pickup' && parseFloat(transportationFee) > 0 && (
                    <>
                      <div>
                        <div className="text-xs text-gray-600">Transportation Fee</div>
                        <div className="text-lg font-semibold text-red-600">-₱{parseFloat(transportationFee).toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-600">Net Payment</div>
                        <div className="text-lg font-semibold text-blue-700">₱{estimatedNetPayment.min.toFixed(2)} - ₱{estimatedNetPayment.max.toFixed(2)}</div>
                      </div>
                    </>
                  )}
                </div>
                <p className="text-xs text-gray-600 mt-2 italic">*Final valuation will be determined after inspection and weighing</p>
              </div>
            )}

            {/* Delivery Method */}
            <div>
              <label className="block text-sm font-medium mb-2">Delivery Method</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    checked={deliveryMethod === 'dropoff'} 
                    onChange={() => setDeliveryMethod('dropoff')} 
                  />
                  <span>Drop-off at Junkshop</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    checked={deliveryMethod === 'pickup'} 
                    onChange={() => setDeliveryMethod('pickup')} 
                  />
                  <span>Request Pickup</span>
                </label>
              </div>
            </div>

            {/* Pickup Details */}
            {deliveryMethod === 'pickup' && (
              <div className="bg-blue-50 border border-blue-200 rounded p-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Pickup Address</label>
                  <textarea 
                    value={pickupAddress} 
                    onChange={e => setPickupAddress(e.target.value)} 
                    placeholder="Street address, barangay, city"
                    className="w-full p-2 border rounded text-sm"
                  />
                  {errors.pickupAddress && <div className="text-red-500 text-xs">{errors.pickupAddress}</div>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Preferred Date</label>
                    <input 
                      value={pickupDate} 
                      onChange={e => setPickupDate(e.target.value)} 
                      type="date"
                      className="w-full p-2 border rounded text-sm"
                    />
                    {errors.pickupDate && <div className="text-red-500 text-xs">{errors.pickupDate}</div>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Preferred Time</label>
                    <input 
                      value={pickupTime} 
                      onChange={e => setPickupTime(e.target.value)} 
                      type="time"
                      className="w-full p-2 border rounded text-sm"
                    />
                    {errors.pickupTime && <div className="text-red-500 text-xs">{errors.pickupTime}</div>}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Transportation Fee (₱)</label>
                  <input 
                    value={transportationFee} 
                    onChange={e => setTransportationFee(e.target.value)} 
                    type="number" 
                    step="0.01"
                    placeholder="0.00"
                    className="w-full p-2 border rounded text-sm"
                  />
                  <p className="text-xs text-gray-600 mt-1">Fee will be deducted from your earnings</p>
                </div>
              </div>
            )}

            {/* Non-Acceptable Items Warning */}
            <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
              <div className="font-semibold text-sm mb-2 text-yellow-800">⚠ Non-Acceptable Items</div>
              <ul className="text-xs text-gray-700 space-y-1 mb-3">
                {NON_ACCEPTABLE_ITEMS.map(item => (
                  <li key={item} className="flex gap-2">
                    <span>•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <label className="flex items-start gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={nonAcceptableWarningAccepted} 
                  onChange={e => setNonAcceptableWarningAccepted(e.target.checked)}
                  className="mt-1"
                />
                <span className="text-xs">I confirm that my submission does not contain any non-acceptable items</span>
              </label>
              {errors.nonAcceptableWarning && <div className="text-red-500 text-xs mt-1">{errors.nonAcceptableWarning}</div>}
            </div>
          </>
        )}

        {/* Image Upload */}
        <div>
          <label className="block text-sm font-medium mb-1">Product Image</label>
          <input 
            type="file" 
            accept="image/*" 
            onChange={onFileChange} 
            className="w-full p-2 border rounded" 
            required 
          />
          {errors.image && <div className="text-red-500 text-sm">{errors.image}</div>}
        </div>

        {preview && (
          <div>
            <img src={preview} alt="preview" className="w-32 h-32 object-cover rounded border" />
          </div>
        )}

        {/* Submit Button */}
        <button 
          disabled={saving || (isRecyclable && loadingCategories)} 
          className="p-3 bg-teal-600 text-white rounded font-semibold min-h-[44px] text-base hover:bg-teal-700 active:bg-teal-800 transition disabled:bg-gray-400"
        >
          {saving ? 'Saving...' : (isRecyclable && loadingCategories ? 'Loading...' : 'Upload')}
        </button>
      </form>
    </div>
  )
}