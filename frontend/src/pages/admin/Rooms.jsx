import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, X, BedDouble, Key, Settings, Image as ImageIcon, CheckCircle, AlertTriangle, MapPin, Search, Package, RefreshCw, Building2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useRealtimeSync } from '../../lib/useRealtimeSync';
import toast from 'react-hot-toast';
import { clearCache } from '../../utils/cache';
import { useAuth } from '../../context/AuthContext';
import GuestServices from './GuestServices';
import { optimizeImage } from '../../utils/imageOptimizer';


const AdminRooms = () => {
  const { hasAccess } = useAuth();
  const [activeTab, setActiveTab] = useState('inventory');
  const [rooms, setRooms] = useState([]);
  const [halls, setHalls] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Modals for Halls
  const [isHallModalOpen, setIsHallModalOpen] = useState(false);
  const [editingHall, setEditingHall] = useState(null);
  const [hallForm, setHallForm] = useState({
    name: '',
    capacity: 50,
    size_sqm: 100,
    base_price_ngn: 150000,
    hourly_price_ngn: 20000,
    description: '',
    amenities: '',
    image_url: '',
    is_active: true
  });
  
  const [categories, setCategories] = useState([]);
  const [featuresList, setFeaturesList] = useState([]);
  const [purposeAdjustments, setPurposeAdjustments] = useState({
    Leisure: { type: 'percentage', value: 0 },
    Business: { type: 'percentage', value: -10 },
    Party: { type: 'percentage', value: 50 },
    Event: { type: 'percentage', value: 20 },
    Medical: { type: 'percentage', value: -15 },
    Other: { type: 'percentage', value: 0 }
  });
  
  // Modals
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [isWalkinModalOpen, setIsWalkinModalOpen] = useState(false);
  
  const [isEdit, setIsEdit] = useState(false);
  const [currentRoom, setCurrentRoom] = useState(null);

  const [newRoom, setNewRoom] = useState({ 
    room_number: '', name: '', type: '', property_id: '',
    capacity: 2, size_sqm: 50, base_price_ngn: 50000,
    image_url: '', amenities: [], description: '',
    images: [], video_url: '', status: 'available',
    bed_configuration: '1 King Bed',
    min_stay_days: 1, max_stay_days: 30,
    allowed_check_in_days: [0, 1, 2, 3, 4, 5, 6],
    allowed_check_out_days: [0, 1, 2, 3, 4, 5, 6],
    pricing_model: 'per_night', base_guests: 2
  });

  const [isBulkAdd, setIsBulkAdd] = useState(false);
  const [bulkPrefix, setBulkPrefix] = useState('10');
  const [bulkCount, setBulkCount] = useState(3);
  const [bulkName, setBulkName] = useState('');

  useEffect(() => {
    fetchData(false); // non-blocking SWR background load on tab switch
  }, [activeTab]);

  // Real-time synchronization for rooms and halls table changes
  useRealtimeSync(['rooms', 'halls'], () => {
    fetchData(true);
  });

  const fetchData = async (force = true) => {
    // Only show blocking loader on very first mount or when explicitly forced (after mutations)
    const isFirstLoad = rooms.length === 0 && properties.length === 0;
    if (isFirstLoad || force) {
      setLoading(true);
    }

    try {
      // 1. Build parallel promises for dynamically required resources
      const roomsPromise = (activeTab === 'inventory' || force)
        ? supabase.from('rooms').select('id, room_number, name, type, property_id, capacity, size_sqm, base_price_ngn, status, properties(name)').order('room_number', { ascending: true })
        : Promise.resolve({ data: null });

      const hallsPromise = (activeTab === 'halls' || force)
        ? supabase.from('halls').select('*').order('name')
        : Promise.resolve({ data: null });

      const propertiesPromise = (properties.length === 0 || force)
        ? supabase.from('properties').select('*').order('name')
        : Promise.resolve({ data: null });

      const cmsPromise = (categories.length === 0 || activeTab === 'categories' || force)
        ? supabase.from('cms_pages').select('content').eq('slug', 'system_categories').single()
        : Promise.resolve({ data: null });

      // 2. Fetch in parallel to prevent sequential database query waterfall (latency is cut by up to 66%)
      const [roomsRes, hallsRes, propertiesRes, cmsRes] = await Promise.all([
        roomsPromise,
        hallsPromise,
        propertiesPromise,
        cmsPromise
      ]);

      // 3. Batch process responses safely
      if (roomsRes && roomsRes.data) {
        setRooms(roomsRes.data);
      }

      if (hallsRes && hallsRes.data) {
        setHalls(hallsRes.data);
      }
      
      if (propertiesRes && propertiesRes.data) {
        setProperties(propertiesRes.data);
        if (propertiesRes.data.length > 0 && !newRoom.property_id) {
          setNewRoom(prev => ({ ...prev, property_id: propertiesRes.data[0].id }));
        }
      }

      const defaultCats = ['Studio', 'Suite', 'Penthouse'];
      const defaultFeats = ['Air Conditioning', 'High-Speed Wi-Fi', 'Smart TV', 'Balcony', 'Fully Equipped Kitchen', 'Pool Access', 'Smart Lock'];

      if (cmsRes && cmsRes.data && cmsRes.data.content) {
        setCategories(cmsRes.data.content.categories || defaultCats);
        setFeaturesList(cmsRes.data.content.features || defaultFeats);
        if (cmsRes.data.content.purpose_adjustments) {
          const parsedAdjustments = {};
          Object.entries(cmsRes.data.content.purpose_adjustments).forEach(([purpose, val]) => {
            if (val && typeof val === 'object' && 'type' in val && 'value' in val) {
              parsedAdjustments[purpose] = val;
            } else {
              parsedAdjustments[purpose] = { type: 'percentage', value: Number(val) || 0 };
            }
          });
          setPurposeAdjustments(parsedAdjustments);
        }
      } else if (categories.length === 0) {
        setCategories(defaultCats);
        setFeaturesList(defaultFeats);
      }
    } catch (e) {
      console.error("Failed loading data in property management:", e);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Database persistence for Categories and Features
  const updateSystemDictionaries = async (newCats, newFeats) => {
    const { data: existing } = await supabase.from('cms_pages').select('id, content').eq('slug', 'system_categories').maybeSingle();
    let error;
    const contentPayload = {
      categories: newCats,
      features: newFeats,
      purpose_adjustments: existing?.content?.purpose_adjustments || purposeAdjustments
    };
    if (existing) {
      ({ error } = await supabase.from('cms_pages').update({ 
        content: contentPayload 
      }).eq('slug', 'system_categories'));
    } else {
      ({ error } = await supabase.from('cms_pages').insert([{ 
        slug: 'system_categories', 
        title: 'System Categories', 
        content: contentPayload 
      }]));
    }
    
    if (error) {
      toast.error('Failed to update system database');
    } else {
      setCategories(newCats);
      setFeaturesList(newFeats);
      toast.success('Database updated successfully');
    }
  };

  const updatePurposeAdjustments = async (newPurposes) => {
    const { data: existing } = await supabase.from('cms_pages').select('id, content').eq('slug', 'system_categories').maybeSingle();
    let error;
    const contentPayload = {
      categories: existing?.content?.categories || categories,
      features: existing?.content?.features || featuresList,
      purpose_adjustments: newPurposes
    };
    if (existing) {
      ({ error } = await supabase.from('cms_pages').update({ 
        content: contentPayload 
      }).eq('slug', 'system_categories'));
    } else {
      ({ error } = await supabase.from('cms_pages').insert([{ 
        slug: 'system_categories', 
        title: 'System Categories', 
        content: contentPayload 
      }]));
    }
    
    if (error) {
      toast.error('Failed to update purpose settings');
    } else {
      setPurposeAdjustments(newPurposes);
      toast.success('Purpose pricing configurations updated!');
    }
  };

  const handleAddPurpose = () => {
    const input = document.getElementById('newPurposeName');
    const name = input ? input.value.trim() : '';
    if (!name) return toast.error("Please enter a name for the stay purpose");
    if (purposeAdjustments[name]) return toast.error("This stay purpose already exists");
    
    const newPurposes = {
      ...purposeAdjustments,
      [name]: { type: 'percentage', value: 0 }
    };
    setPurposeAdjustments(newPurposes);
    if (input) input.value = '';
    toast.success(`"${name}" added successfully! Click "Save" to apply changes.`);
  };

  const handleDeletePurpose = (name) => {
    const newPurposes = { ...purposeAdjustments };
    delete newPurposes[name];
    setPurposeAdjustments(newPurposes);
    toast.success(`"${name}" removed. Click "Save" to apply changes.`);
  };

  const handleUpdatePurposeProp = (purpose, prop, value) => {
    setPurposeAdjustments(prev => ({
      ...prev,
      [purpose]: {
        ...prev[purpose],
        [prop]: value
      }
    }));
  };

  const addCategory = () => {
    const val = document.getElementById('newCat').value.trim();
    if(val && !categories.includes(val)) {
      updateSystemDictionaries([...categories, val], featuresList);
      document.getElementById('newCat').value = '';
    }
  };

  const removeCategory = (cat) => {
    updateSystemDictionaries(categories.filter(c => c !== cat), featuresList);
  };

  const addFeature = () => {
    const val = document.getElementById('newFeat').value.trim();
    if(val && !featuresList.includes(val)) {
      updateSystemDictionaries(categories, [...featuresList, val]);
      document.getElementById('newFeat').value = '';
    }
  };

  const removeFeature = (feat) => {
    updateSystemDictionaries(categories, featuresList.filter(f => f !== feat));
  };


  // ================= ROOM MANAGEMENT =================
  const openRoomModal = async (room = null) => {
    setIsBulkAdd(false);
    setBulkName('');
    setBulkPrefix('10');
    if (room) {
      setIsEdit(true);
      const loadingToastId = toast.loading('Loading complete room configurations...');
      try {
        const { data: fullRoom, error } = await supabase
          .from('rooms')
          .select('*')
          .eq('id', room.id)
          .single();
          
        if (error) throw error;
        
        setCurrentRoom(fullRoom);
        let extended = {};
        try { 
          extended = JSON.parse(fullRoom.description || '{}'); 
          if (extended && typeof extended.text === 'string' && extended.text.trim().startsWith('{')) {
            try {
              const nested = JSON.parse(extended.text);
              if (nested && typeof nested === 'object') {
                extended = { ...extended, ...nested };
              }
            } catch (e) {}
          }
        } catch (e) {}
        
        setNewRoom({
          room_number: fullRoom.room_number,
          name: fullRoom.name,
          type: fullRoom.type,
          property_id: fullRoom.property_id || (properties[0]?.id || ''),
          capacity: fullRoom.capacity,
          size_sqm: fullRoom.size_sqm || 50,
          base_price_ngn: fullRoom.base_price_ngn,
          image_url: fullRoom.image_url || '',
          amenities: fullRoom.amenities || [],
          description: typeof extended === 'object' && 'text' in extended ? extended.text : (fullRoom.description || ''),
          images: extended.images || [],
          video_url: extended.video_url || '',
          status: fullRoom.status,
          bed_configuration: extended.bed_configuration || '1 King Bed',
          min_stay_days: fullRoom.min_stay_days || 1,
          max_stay_days: fullRoom.max_stay_days || 30,
          allowed_check_in_days: fullRoom.allowed_check_in_days || [0, 1, 2, 3, 4, 5, 6],
          allowed_check_out_days: fullRoom.allowed_check_out_days || [0, 1, 2, 3, 4, 5, 6],
          sub_category: extended.sub_category || ''
        });
        toast.dismiss(loadingToastId);
        setIsRoomModalOpen(true);
      } catch (err) {
        console.error('Error fetching room details:', err);
        toast.error('Failed to load room details: ' + err.message, { id: loadingToastId });
      }
    } else {
      setIsEdit(false);
      setCurrentRoom(null);
      setNewRoom({ 
        room_number: '', name: '', type: categories[0] || 'Suite', property_id: properties[0]?.id || '',
        capacity: 2, size_sqm: 50, base_price_ngn: 50000,
        image_url: '', amenities: [], description: '',
        images: [], video_url: '', status: 'available',
        bed_configuration: '1 King Bed',
        min_stay_days: 1, max_stay_days: 30,
        allowed_check_in_days: [0, 1, 2, 3, 4, 5, 6],
        allowed_check_out_days: [0, 1, 2, 3, 4, 5, 6],
        sub_category: ''
      });
      setIsRoomModalOpen(true);
    }
  };

  const handleSaveRoom = async (e) => {
    e.preventDefault();
    
    const buildRoomPayload = (rNumber) => ({
      room_number: rNumber,
      name: newRoom.name,
      type: newRoom.type,
      property_id: newRoom.property_id || null,
      capacity: newRoom.capacity,
      size_sqm: newRoom.size_sqm,
      base_price_ngn: newRoom.base_price_ngn,
      image_url: newRoom.images.length > 0 ? newRoom.images[0] : newRoom.image_url,
      amenities: newRoom.amenities,
      status: newRoom.status,
      min_stay_days: newRoom.min_stay_days,
      max_stay_days: newRoom.max_stay_days,
      allowed_check_in_days: newRoom.allowed_check_in_days,
      allowed_check_out_days: newRoom.allowed_check_out_days,
      description: JSON.stringify({
        text: newRoom.description,
        images: newRoom.images,
        video_url: newRoom.video_url,
        bed_configuration: newRoom.bed_configuration,
        sub_category: newRoom.sub_category || ''
      })
    });

    if (isBulkAdd && !isEdit) {
      const payloads = [];
      for(let i=1; i<=bulkCount; i++) {
        const generatedNum = bulkName.trim() ? `${bulkName.trim()} ${bulkPrefix}${i}` : `${bulkPrefix}${i}`;
        const payload = buildRoomPayload(generatedNum);
        if (bulkName.trim()) {
          payload.name = generatedNum;
        }
        payloads.push(payload);
      }
      toast.loading(`Creating ${bulkCount} rooms...`, { id: 'bulk' });
      const { data, error } = await supabase.from('rooms').insert(payloads).select('id, room_number, name, type, property_id, capacity, size_sqm, base_price_ngn, status, properties(name)');
      if (error) toast.error(error.message, { id: 'bulk' });
      else {
        toast.success(`${bulkCount} rooms created!`, { id: 'bulk' });
        clearCache('rooms');
        clearCache('roomDetails');
        setIsRoomModalOpen(false);
        if (data) {
          setRooms(prev => [...prev, ...data].sort((a,b) => a.room_number.localeCompare(b.room_number)));
        } else {
          fetchData(true);
        }
      }
    } else {
      const payload = buildRoomPayload(newRoom.room_number);
      if (isEdit) {
        const { data, error } = await supabase.from('rooms').update(payload).eq('id', currentRoom.id).select('id, room_number, name, type, property_id, capacity, size_sqm, base_price_ngn, status, properties(name)').single();
        if (error) toast.error(error.message);
        else {
          toast.success('Room updated!');
          clearCache('rooms');
          clearCache('roomDetails');
          setIsRoomModalOpen(false);
          if (data) {
            setRooms(prev => prev.map(r => r.id === currentRoom.id ? data : r));
          } else {
            fetchData(true);
          }
        }
      } else {
        const { data, error } = await supabase.from('rooms').insert([payload]).select('id, room_number, name, type, property_id, capacity, size_sqm, base_price_ngn, status, properties(name)');
        if (error) toast.error(error.message);
        else {
          toast.success('Room created!');
          clearCache('rooms');
          clearCache('roomDetails');
          setIsRoomModalOpen(false);
          if (data) {
            setRooms(prev => [...prev, ...data].sort((a,b) => a.room_number.localeCompare(b.room_number)));
          } else {
            fetchData(true);
          }
        }
      }
    }
  };

  const updateRoomStatus = async (id, status) => {
    // Optimistic UI update: update state instantly in-memory for instant visual responsiveness
    setRooms(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    
    const { error } = await supabase.from('rooms').update({ status }).eq('id', id);
    if (error) {
      toast.error(error.message);
      fetchData(true); // Rollback/refetch on error
    } else {
      toast.success(`Room status set to ${status}`);
      clearCache('rooms');
      clearCache('roomDetails');
    }
  };

  const toggleFeature = (feature) => {
    setNewRoom(prev => ({
      ...prev,
      amenities: prev.amenities.includes(feature) 
        ? prev.amenities.filter(f => f !== feature)
        : [...prev.amenities, feature]
    }));
  };

  const handleCategoryChange = (e) => {
    const cat = e.target.value;
    const isFlat = cat && cat.toLowerCase().includes('flat');
    setNewRoom(prev => {
      const updated = { ...prev, type: cat };
      if (isFlat) {
        updated.sub_category = '3 Bedroom Flat';
        updated.bed_configuration = '3 King Beds';
        updated.capacity = 6;
      } else {
        updated.sub_category = '';
      }
      return updated;
    });
  };

  const handleSubCategoryChange = (e) => {
    const subCat = e.target.value;
    let defaultBedConfig = '1 King Bed';
    let defaultCapacity = 2;
    if (subCat.includes('4')) {
      defaultBedConfig = '4 King Beds';
      defaultCapacity = 8;
    } else if (subCat.includes('3')) {
      defaultBedConfig = '3 King Beds';
      defaultCapacity = 6;
    } else if (subCat.includes('2')) {
      defaultBedConfig = '2 King Beds';
      defaultCapacity = 4;
    } else if (subCat.includes('1')) {
      defaultBedConfig = '1 King Bed';
      defaultCapacity = 2;
    }
    setNewRoom(prev => ({
      ...prev,
      sub_category: subCat,
      bed_configuration: defaultBedConfig,
      capacity: defaultCapacity
    }));
  };

  const getBedConfigurationOptions = () => {
    const sub = newRoom.sub_category || '';
    if (sub.includes('4')) {
      return [
        { value: '4 King Beds', label: '4 King Beds' },
        { value: '4 Queen Beds', label: '4 Queen Beds' },
        { value: '3 King Beds, 2 Twin Beds', label: '3 King Beds, 2 Twin Beds' },
        { value: '2 King Beds, 4 Twin Beds', label: '2 King Beds, 4 Twin Beds' }
      ];
    } else if (sub.includes('3')) {
      return [
        { value: '3 King Beds', label: '3 King Beds' },
        { value: '3 Queen Beds', label: '3 Queen Beds' },
        { value: '2 King Beds, 2 Twin Beds', label: '2 King Beds, 2 Twin Beds' },
        { value: '1 King Bed, 4 Twin Beds', label: '1 King Bed, 4 Twin Beds' }
      ];
    } else if (sub.includes('2')) {
      return [
        { value: '2 King Beds', label: '2 King Beds' },
        { value: '2 Queen Beds', label: '2 Queen Beds' },
        { value: '1 King Bed, 2 Twin Beds', label: '1 King Bed, 2 Twin Beds' },
        { value: '4 Twin Beds', label: '4 Twin Beds' }
      ];
    } else if (sub.includes('1')) {
      return [
        { value: '1 King Bed', label: '1 King Bed' },
        { value: '1 Queen Bed', label: '1 Queen Bed' },
        { value: '2 Twin Beds', label: '2 Twin Beds' }
      ];
    }
    return [
      { value: '1 King Bed', label: '1 King Bed' },
      { value: '1 Queen Bed', label: '1 Queen Bed' },
      { value: '2 Twin Beds', label: '2 Twin Beds' },
      { value: '1 King, 1 Sofa Bed', label: '1 King, 1 Sofa Bed' }
    ];
  };

  const [optimizingExisting, setOptimizingExisting] = useState(false);

  const handleOptimizeExistingImages = async () => {
    if (optimizingExisting) return;
    if (!window.confirm("Are you sure you want to optimize all existing room images? This will compress the existing room base64 images to under 100KB to make page loading faster, while preserving the original photos. This process is safe and will not change the actual pictures.")) return;

    setOptimizingExisting(true);
    const toastId = toast.loading("Fetching rooms for optimization...");

    try {
      const { data: roomList, error: fetchErr } = await supabase.from('rooms').select('id, room_number');
      if (fetchErr) throw fetchErr;

      if (!roomList || roomList.length === 0) {
        toast.success("No rooms found to optimize.", { id: toastId });
        setOptimizingExisting(false);
        return;
      }

      let optimizedCount = 0;
      let totalSkipped = 0;

      for (let i = 0; i < roomList.length; i++) {
        const r = roomList[i];
        toast.loading(`Optimizing Room ${r.room_number} (${i + 1}/${roomList.length})...`, { id: toastId });

        const { data: room, error: getErr } = await supabase
          .from('rooms')
          .select('id, room_number, image_url, description')
          .eq('id', r.id)
          .single();

        if (getErr || !room) {
          console.error(`Error loading room ${r.room_number}:`, getErr);
          continue;
        }

        let descObj = {};
        try {
          descObj = JSON.parse(room.description || '{}');
        } catch(e) {}

        let needsUpdate = false;
        let optimizedUrl = room.image_url;
        let optimizedDescImages = descObj.images || [];

        // 1. Optimize main image_url
        if (room.image_url && room.image_url.startsWith('data:image/') && room.image_url.length >= 110000) {
          optimizedUrl = await optimizeImage(room.image_url, 800, 800, 0.7);
          needsUpdate = true;
        }

        // 2. Optimize images in description JSON
        if (descObj.images && descObj.images.length > 0) {
          const newDescImages = [];
          for (const img of descObj.images) {
            if (img && img.startsWith('data:image/') && img.length >= 110000) {
              const optImg = await optimizeImage(img, 800, 800, 0.7);
              newDescImages.push(optImg);
              needsUpdate = true;
            } else {
              newDescImages.push(img);
            }
          }
          optimizedDescImages = newDescImages;
        }

        if (needsUpdate) {
          const updatedDescription = JSON.stringify({
            ...descObj,
            images: optimizedDescImages
          });

          const { error: updateErr } = await supabase
            .from('rooms')
            .update({
              image_url: optimizedUrl,
              description: updatedDescription
            })
            .eq('id', room.id);

          if (updateErr) {
            console.error(`Error updating room ${room.room_number}:`, updateErr);
            throw updateErr;
          }
          optimizedCount++;
        } else {
          totalSkipped++;
        }
      }

      toast.success(`Done! Optimized ${optimizedCount} rooms (${totalSkipped} rooms already optimized).`, { id: toastId, duration: 4000 });
      clearCache('rooms');
      clearCache('roomDetails');
      fetchData(true);
    } catch (err) {
      console.error("Failed to optimize existing room images:", err);
      toast.error(`Optimization failed: ${err.message}`, { id: toastId });
    } finally {
      setOptimizingExisting(false);
    }
  };

  const handleImageUpload = (e, setter) => {
    const files = Array.from(e.target.files);
    const loadingToastId = toast.loading('Reading and optimizing image uploads...');
    Promise.all(files.map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          optimizeImage(reader.result, 800, 800, 0.7).then(resolve);
        };
        reader.readAsDataURL(file);
      });
    })).then(base64Images => {
      setter(prev => ({ ...prev, images: [...(prev.images || []), ...base64Images] }));
      toast.success('Images uploaded and optimized successfully!', { id: loadingToastId });
    }).catch(err => {
      console.error(err);
      toast.error('Failed to optimize images.', { id: loadingToastId });
    });
  };


  // Property management features have been consolidated under Settings.jsx Multi-Branch Management

  const removeRoom = async (id) => {
    // Optimistic delete: immediately filter out of rooms state for instant visual feedback
    const originalRooms = [...rooms];
    setRooms(prev => prev.filter(r => r.id !== id));

    const { error } = await supabase.from('rooms').delete().eq('id', id);
    if (error) {
      toast.error(error.message);
      setRooms(originalRooms); // Rollback state on failure
    } else {
      toast.success('Room deleted');
      clearCache('rooms');
      clearCache('roomDetails');
    }
  };

  // --- Hall CRUD Operations ---
  const handleSaveHall = async (e) => {
    e.preventDefault();
    if (!hallForm.name.trim()) return toast.error("Please enter a name for the hall.");
    
    setIsSaving(true);
    const toastId = toast.loading("Saving hall profile...");
    try {
      const payload = {
        name: hallForm.name.trim(),
        capacity: Number(hallForm.capacity),
        size_sqm: Number(hallForm.size_sqm),
        base_price_ngn: Number(hallForm.base_price_ngn),
        hourly_price_ngn: Number(hallForm.hourly_price_ngn),
        description: hallForm.description.trim(),
        amenities: hallForm.amenities.split(',').map(a => a.trim()).filter(Boolean),
        image_url: hallForm.image_url.trim() || null,
        is_active: hallForm.is_active
      };

      let error;
      if (editingHall) {
        ({ error } = await supabase.from('halls').update(payload).eq('id', editingHall.id));
      } else {
        ({ error } = await supabase.from('halls').insert([payload]));
      }

      if (error) throw error;
      toast.success(editingHall ? "Hall updated!" : "New Hall registered!", { id: toastId });
      setIsHallModalOpen(false);
      setEditingHall(null);
      fetchData(true);
    } catch (err) {
      console.error(err);
      toast.error(err.message, { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteHall = async (id) => {
    if (!window.confirm("Are you sure you want to delete this hall? This action cannot be undone.")) return;
    try {
      const { error } = await supabase.from('halls').delete().eq('id', id);
      if (error) throw error;
      toast.success("Hall deleted successfully.");
      fetchData(true);
    } catch (err) {
      toast.error("Cannot delete hall. It may have existing bookings.");
    }
  };

  // ================= RENDER =================
  return (
    <div className="space-y-6 pb-20 text-white">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Rooms, Halls & Inventory Management</h1>
          <p className="text-gray-200 mt-1">Manage physical properties, room types, event halls, inventory, and capacities.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setIsWalkinModalOpen(true)} className="bg-green-600 hover:bg-green-500 text-white py-2 px-4 rounded-md font-medium flex items-center gap-2 transition-colors">
            <CheckCircle size={18} /> Walk-in Check-in
          </button>
        </div>
      </div>

      {/* TABS */}
      <div className="flex border-b border-dark-700 bg-dark-800 p-1 rounded-t-lg">
        <button onClick={() => setActiveTab('inventory')} className={`flex-1 py-3 font-medium rounded text-center transition-colors ${activeTab === 'inventory' ? 'bg-dark-700 text-gold-500 shadow-sm' : 'text-gray-200 hover:text-white hover:bg-dark-700/50'}`}>Room Units</button>
        <button onClick={() => setActiveTab('halls')} className={`flex-1 py-3 font-medium rounded text-center transition-colors ${activeTab === 'halls' ? 'bg-dark-700 text-gold-500 shadow-sm' : 'text-gray-200 hover:text-white hover:bg-dark-700/50'}`}>Event Halls Inventory</button>
        <button onClick={() => setActiveTab('categories')} className={`flex-1 py-3 font-medium rounded text-center transition-colors ${activeTab === 'categories' ? 'bg-dark-700 text-gold-500 shadow-sm' : 'text-gray-200 hover:text-white hover:bg-dark-700/50'}`}>Categories & Features</button>
        {hasAccess('Guest Services') && (
          <button onClick={() => setActiveTab('services')} className={`flex-1 py-3 font-medium rounded text-center transition-colors ${activeTab === 'services' ? 'bg-dark-700 text-gold-500 shadow-sm' : 'text-gray-200 hover:text-white hover:bg-dark-700/50'}`}>Guest Add-ons</button>
        )}
      </div>

      <div className="bg-dark-800 border border-dark-700 p-6 rounded-b-lg shadow-sm min-h-[500px]">
        {loading ? (
          <div className="py-12 text-center text-gray-300">Loading module data...</div>
        ) : (
          <>
            {/* TAB: INVENTORY */}
            {activeTab === 'inventory' && (
              <div className="animate-in fade-in duration-300">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex gap-4">
                    <div className="bg-dark-900 border border-dark-700 px-4 py-2 rounded flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-green-500"></span>
                      <span className="text-sm font-medium">{rooms.filter(r => r.status === 'available').length} Available</span>
                    </div>
                    <div className="bg-dark-900 border border-dark-700 px-4 py-2 rounded flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                      <span className="text-sm font-medium">{rooms.filter(r => r.status === 'occupied').length} Occupied</span>
                    </div>
                    <div className="bg-dark-900 border border-dark-700 px-4 py-2 rounded flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-red-500"></span>
                      <span className="text-sm font-medium">{rooms.filter(r => r.status === 'maintenance').length} Maintenance</span>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={handleOptimizeExistingImages} 
                      disabled={optimizingExisting}
                      className="bg-dark-700 hover:bg-dark-650 border border-dark-600 text-gold-500 py-2 px-4 rounded flex items-center gap-2 text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                      <RefreshCw size={16} className={optimizingExisting ? 'animate-spin' : ''} />
                      {optimizingExisting ? 'Optimizing...' : 'Optimize Existing Images'}
                    </button>
                    <button onClick={() => openRoomModal()} className="btn-primary py-2 px-4 flex items-center gap-2 text-sm"><Plus size={18}/> Add Room Units</button>
                  </div>

                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-dark-900 border-b border-dark-700 text-gray-200 uppercase tracking-wider">
                      <tr>
                        <th className="p-4 font-medium">Unit No.</th>
                        <th className="p-4 font-medium">Property</th>
                        <th className="p-4 font-medium">Type / Details</th>
                        <th className="p-4 font-medium">Pricing</th>
                        <th className="p-4 font-medium">Status / Actions</th>
                        <th className="p-4 font-medium text-right">Edit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-700">
                      {rooms.length === 0 && <tr><td colSpan="6" className="p-8 text-center text-gray-300">No rooms generated yet.</td></tr>}
                      {rooms.map(room => (
                        <tr key={room.id} className="hover:bg-dark-700/50 transition-colors">
                          <td className="p-4 font-bold text-lg text-white">
                            <span className="flex items-center gap-2"><Key size={16} className="text-gold-500"/> {room.room_number}</span>
                            {room.name && <p className="text-xs text-gray-200 font-normal mt-1">{room.name}</p>}
                          </td>
                          <td className="p-4 text-gray-300">{room.properties?.name || 'HQ'}</td>
                          <td className="p-4">
                            <p className="font-semibold text-white">{room.type}</p>
                            <p className="text-xs text-gray-200 mt-1">Cap: {room.capacity} | {room.size_sqm}sqm</p>
                          </td>
                          <td className="p-4 font-medium text-gold-500">₦{Number(room.base_price_ngn).toLocaleString()}/nt</td>
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <select 
                                value={room.status} 
                                onChange={(e) => updateRoomStatus(room.id, e.target.value)}
                                className={`text-xs font-bold uppercase tracking-wider px-2 py-1.5 rounded outline-none cursor-pointer border ${
                                  room.status === 'available' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                                  room.status === 'occupied' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                                  'bg-red-500/10 text-red-500 border-red-500/20'
                                }`}
                              >
                                <option value="available" className="bg-dark-900 text-white">Available</option>
                                <option value="occupied" className="bg-dark-900 text-white">Occupied</option>
                                <option value="maintenance" className="bg-dark-900 text-white">Maintenance Lockout</option>
                              </select>
                            </div>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex justify-end gap-3 text-gray-200">
                              <button onClick={() => openRoomModal(room)} className="hover:text-gold-500 transition-colors"><Settings size={18}/></button>
                              <button onClick={() => removeRoom(room.id)} className="hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB: HALLS INVENTORY */}
            {activeTab === 'halls' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex gap-4">
                    <div className="bg-dark-900 border border-dark-700 px-4 py-2 rounded flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-green-500"></span>
                      <span className="text-sm font-medium">{halls.filter(h => h.is_active).length} Active Halls</span>
                    </div>
                    <div className="bg-dark-900 border border-dark-700 px-4 py-2 rounded flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-red-500"></span>
                      <span className="text-sm font-medium">{halls.filter(h => !h.is_active).length} Under Maintenance</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setEditingHall(null);
                      setHallForm({
                        name: '', capacity: 50, size_sqm: 100,
                        base_price_ngn: 150000, hourly_price_ngn: 20000,
                        description: '', amenities: '', image_url: '', is_active: true
                      });
                      setIsHallModalOpen(true);
                    }}
                    className="bg-brand-600 hover:bg-brand-500 text-white py-2.5 px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer border-0"
                  >
                    <Plus size={16} /> Add Event Hall
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                  {halls.length === 0 && (
                    <div className="col-span-2 py-12 text-center text-gray-300">No event halls registered yet.</div>
                  )}
                  {halls.map(hall => (
                    <div key={hall.id} className="bg-dark-900/40 border border-dark-750 p-5 rounded-2xl flex flex-col justify-between hover:border-brand-500/30 transition-all duration-300">
                      <div>
                        <div className="flex justify-between items-start">
                          <h4 className="text-lg font-bold text-white flex items-center gap-2">
                            <Building2 size={18} className="text-gold-500" />
                            {hall.name}
                          </h4>
                          <span className={`text-xs px-2 py-0.5 rounded border ${hall.is_active ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                            {hall.is_active ? 'Active' : 'Maintenance'}
                          </span>
                        </div>
                        <p className="text-gray-200 text-xs mt-2 line-clamp-2 leading-relaxed">{hall.description || 'No description provided.'}</p>
                        
                        <div className="grid grid-cols-3 gap-3 my-4">
                          <div className="bg-dark-950/40 p-2.5 rounded-xl border border-dark-850 text-center">
                            <span className="text-gray-550 text-[10px] uppercase font-bold tracking-wider">Capacity</span>
                            <p className="text-white font-bold text-sm mt-0.5">{hall.capacity} guests</p>
                          </div>
                          <div className="bg-dark-950/40 p-2.5 rounded-xl border border-dark-850 text-center">
                            <span className="text-gray-550 text-[10px] uppercase font-bold tracking-wider">Size</span>
                            <p className="text-white font-bold text-sm mt-0.5">{hall.size_sqm} sqm</p>
                          </div>
                          <div className="bg-dark-950/40 p-2.5 rounded-xl border border-dark-850 text-center">
                            <span className="text-gray-550 text-[10px] uppercase font-bold tracking-wider">Hourly Price</span>
                            <p className="text-gold-500 font-bold text-sm mt-0.5">₦{Number(hall.hourly_price_ngn).toLocaleString()}</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {hall.amenities?.map((a, idx) => (
                            <span key={idx} className="bg-dark-950 text-gray-200 border border-dark-800 px-2 py-1 text-[11px] font-semibold rounded-lg">{a}</span>
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-between items-center border-t border-dark-800/40 pt-4 mt-2">
                        <div className="text-xs">
                          <span className="text-gray-300 uppercase tracking-widest text-[9px] font-bold block">Daily Rate</span>
                          <span className="text-gold-500 font-black text-lg">₦{Number(hall.base_price_ngn).toLocaleString()}/day</span>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            type="button"
                            onClick={() => {
                              setEditingHall(hall);
                              setHallForm({
                                name: hall.name,
                                capacity: hall.capacity,
                                size_sqm: hall.size_sqm || 100,
                                base_price_ngn: hall.base_price_ngn,
                                hourly_price_ngn: hall.hourly_price_ngn,
                                description: hall.description || '',
                                amenities: hall.amenities?.join(', ') || '',
                                image_url: hall.image_url || '',
                                is_active: hall.is_active
                              });
                              setIsHallModalOpen(true);
                            }}
                            className="bg-dark-700 hover:bg-dark-650 p-2 rounded-xl text-gold-500 transition-colors border border-dark-600 cursor-pointer"
                          >
                            <Edit size={16} />
                          </button>
                          <button 
                            type="button"
                            onClick={() => handleDeleteHall(hall.id)}
                            className="bg-dark-700 hover:bg-red-500/20 p-2 rounded-xl text-red-500 transition-colors border border-dark-600 hover:border-red-500/20 cursor-pointer"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Properties tab has been decoupled */}

            {/* TAB: CATEGORIES */}
            {activeTab === 'categories' && (
              <div className="animate-in fade-in duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-xl font-bold mb-4">Room Categories</h3>
                    <div className="bg-dark-900 border border-dark-700 rounded p-4">
                      <div className="flex gap-2 mb-4">
                        <input type="text" id="newCat" placeholder="New Category Name" className="flex-1 bg-dark-800 text-white border border-dark-700 rounded p-2 focus:border-gold-500 outline-none" />
                        <button onClick={addCategory} className="bg-dark-700 hover:bg-dark-600 text-white px-4 rounded font-medium">Add</button>
                      </div>
                      <div className="space-y-2">
                        {categories.map((cat, idx) => (
                          <div key={idx} className="flex justify-between items-center bg-dark-800 p-3 rounded text-sm border border-dark-700">
                            <span className="font-medium text-white">{cat}</span>
                            <button onClick={() => removeCategory(cat)} className="text-red-500 hover:text-red-400"><X size={16}/></button>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-300 mt-4">Categories dictate the grouping in the Booking Engine dropdowns.</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xl font-bold mb-4">Global Features Database</h3>
                    <div className="bg-dark-900 border border-dark-700 rounded p-4">
                      <div className="flex gap-2 mb-4">
                        <input type="text" id="newFeat" placeholder="New Feature/Amenity" className="flex-1 bg-dark-800 text-white border border-dark-700 rounded p-2 focus:border-gold-500 outline-none" />
                        <button onClick={addFeature} className="bg-dark-700 hover:bg-dark-600 text-white px-4 rounded font-medium">Add</button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {featuresList.map((feat, idx) => (
                          <span key={idx} className="bg-gold-500/10 text-gold-500 border border-gold-500/20 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                            {feat} <X size={12} className="cursor-pointer hover:text-white" onClick={() => removeFeature(feat)}/>
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-gray-300 mt-4">These features will be available as checkboxes when configuring new properties or room units.</p>
                    </div>
                  </div>
                                </div>
                {/* NEW BLOCK: Purpose of Stay & Configurable Surcharges & Discounts */}
                <div className="bg-dark-900 border border-dark-700 p-6 rounded-lg mt-8 space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h3 className="text-xl font-bold text-white">Purpose of Stay Surcharges & Discounts</h3>
                      <p className="text-sm text-gray-200 mt-1 font-medium">
                        Configure dynamic price modifiers for guest stays. Surcharges are positive values, and discounts are negative values (e.g. -10% or -5000).
                      </p>
                    </div>
                    {/* Add Purpose input group */}
                    <div className="flex items-center gap-2 bg-dark-950 p-1.5 rounded-lg border border-dark-700 w-full sm:w-auto">
                      <input 
                        type="text" 
                        id="newPurposeName" 
                        placeholder="e.g. Wedding" 
                        className="bg-transparent text-sm text-white px-3 py-1.5 rounded border-none outline-none focus:ring-0 placeholder-gray-500 w-full sm:w-44" 
                      />
                      <button 
                        type="button" 
                        onClick={handleAddPurpose}
                        className="bg-gold-500 hover:bg-gold-400 text-dark-900 font-bold text-xs px-4 py-2 rounded uppercase tracking-wider transition-all whitespace-nowrap"
                      >
                        Add Option
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {Object.entries(purposeAdjustments).map(([purpose, valObj]) => (
                      <div key={purpose} className="bg-dark-800 p-5 border border-dark-700 rounded-xl flex flex-col justify-between hover:border-dark-600 transition-colors shadow-sm relative group">
                        {/* Delete button absolutely positioned inside the card */}
                        <button 
                          type="button"
                          onClick={() => handleDeletePurpose(purpose)}
                          className="absolute top-4 right-4 text-gray-300 hover:text-red-400 transition-colors"
                          title="Delete Stay Purpose"
                        >
                          <Trash2 size={16} />
                        </button>
                        
                        <div className="mb-4">
                          <label className="block text-sm font-bold text-white tracking-wide uppercase">{purpose} Stay</label>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          {/* Modifier Type Toggle */}
                          <div className="flex border border-dark-700 rounded overflow-hidden flex-shrink-0">
                            <button 
                              type="button"
                              onClick={() => handleUpdatePurposeProp(purpose, 'type', 'amount')}
                              className={`px-3 py-1.5 text-xs font-black transition-all ${valObj.type === 'amount' ? 'bg-gold-500 text-dark-900 font-extrabold' : 'bg-dark-900 text-gray-200 hover:text-white'}`}
                            >
                              ₦
                            </button>
                            <button 
                              type="button"
                              onClick={() => handleUpdatePurposeProp(purpose, 'type', 'percentage')}
                              className={`px-3 py-1.5 text-xs font-black transition-all ${valObj.type === 'percentage' ? 'bg-gold-500 text-dark-900 font-extrabold' : 'bg-dark-900 text-gray-200 hover:text-white'}`}
                            >
                              %
                            </button>
                          </div>

                          {/* Modifier Value Input */}
                          <div className="flex-grow flex items-center relative">
                            <input 
                              type="number" 
                              value={valObj.value} 
                              onChange={(e) => handleUpdatePurposeProp(purpose, 'value', parseFloat(e.target.value) || 0)}
                              className="w-full bg-dark-900 border border-dark-700 rounded px-3.5 py-2.5 text-white outline-none focus:border-gold-500 text-sm font-mono font-bold" 
                              placeholder="0"
                            />
                            <span className="absolute right-3.5 text-xs font-semibold text-gray-300">
                              {valObj.type === 'percentage' ? '%' : 'NGN'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end pt-4 border-t border-dark-700">
                    <button 
                      type="button"
                      onClick={() => updatePurposeAdjustments(purposeAdjustments)}
                      className="bg-gold-500 hover:bg-gold-400 text-dark-900 font-bold px-8 py-3 rounded-lg transition-all text-sm shadow-md"
                    >
                      Save Purpose Configurations
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'services' && hasAccess('Guest Services') && (
              <div className="animate-in fade-in duration-300">
                <GuestServices />
              </div>
            )}
          </>
        )}
      </div>

      {/* ================= MODALS ================= */}

      {/* Room Unit Modal */}
      {isRoomModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-dark-800 border border-dark-700 p-6 w-full max-w-2xl shadow-2xl relative animate-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button onClick={() => setIsRoomModalOpen(false)} className="absolute top-4 right-4 text-gray-200 hover:text-white"><X size={24}/></button>
            <h2 className="text-xl font-bold mb-6 text-white">{isEdit ? 'Edit Room Configuration' : 'Create Room Inventory'}</h2>
            
            <form onSubmit={handleSaveRoom} className="space-y-6">
              
              {!isEdit && (
                <div className="flex items-center gap-3 bg-dark-900 p-4 border border-dark-700 rounded mb-4">
                  <input type="checkbox" id="bulkAdd" checked={isBulkAdd} onChange={e => setIsBulkAdd(e.target.checked)} className="w-5 h-5 accent-gold-500" />
                  <div>
                    <label htmlFor="bulkAdd" className="font-bold text-white block">Bulk Generate Units</label>
                    <span className="text-xs text-gray-200">Generate multiple identical rooms at once (e.g., Rooms 101, 102, 103).</span>
                  </div>
                </div>
              )}

              {isBulkAdd && !isEdit ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-dark-900 p-4 border border-dark-700 rounded">
                  <div>
                    <label className="block text-xs font-bold text-gray-200 mb-1 uppercase tracking-wider">Base Name (e.g. "Julex")</label>
                    <input 
                      type="text" 
                      value={bulkName} 
                      onChange={e => setBulkName(e.target.value)} 
                      placeholder="e.g. Julex"
                      className="w-full bg-dark-800 border border-dark-600 p-2 text-sm text-white outline-none focus:border-gold-500 rounded" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-200 mb-1 uppercase tracking-wider">Number Prefix (e.g. "10")</label>
                    <input 
                      type="text" 
                      required 
                      value={bulkPrefix} 
                      onChange={e => setBulkPrefix(e.target.value)} 
                      className="w-full bg-dark-800 border border-dark-600 p-2 text-sm text-white outline-none focus:border-gold-500 rounded" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-200 mb-1 uppercase tracking-wider">Quantity to Generate</label>
                    <input 
                      type="number" 
                      min="1" 
                      max="50" 
                      required 
                      value={bulkCount} 
                      onChange={e => setBulkCount(parseInt(e.target.value))} 
                      className="w-full bg-dark-800 border border-dark-600 p-2 text-sm text-white outline-none focus:border-gold-500 rounded" 
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-200 mb-1">Room Number / Identifier</label>
                    <input type="text" required value={newRoom.room_number} onChange={e => setNewRoom({...newRoom, room_number: e.target.value})} className="w-full bg-dark-900 border border-dark-700 p-2 text-white outline-none focus:border-gold-500" placeholder="e.g. 101 or Penthouse A" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-200 mb-1">Marketing Name (Optional)</label>
                    <input type="text" value={newRoom.name} onChange={e => setNewRoom({...newRoom, name: e.target.value})} className="w-full bg-dark-900 border border-dark-700 p-2 text-white outline-none focus:border-gold-500" placeholder="Ocean View Suite" />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-200 mb-1">Property Branch</label>
                  <select required value={newRoom.property_id} onChange={e => setNewRoom({...newRoom, property_id: e.target.value})} className="w-full bg-dark-900 border border-dark-700 p-2 text-white outline-none focus:border-gold-500">
                    <option value="" disabled>Select Property</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-200 mb-1">Room Category</label>
                  <select required value={newRoom.type} onChange={handleCategoryChange} className="w-full bg-dark-900 border border-dark-700 p-2 text-white outline-none focus:border-gold-500">
                    {categories.map((cat, idx) => <option key={idx} value={cat}>{cat}</option>)}
                  </select>
                </div>
              </div>

              {newRoom.type && newRoom.type.toLowerCase().includes('flat') && (
                <div className="bg-dark-900/50 border border-dark-700 p-4 rounded-lg space-y-2 animate-in slide-in-from-top-4 duration-300">
                  <label className="block text-sm text-gray-200 mb-1 font-semibold">Room Sub-Category</label>
                  <select 
                    required 
                    value={newRoom.sub_category || '3 Bedroom Flat'} 
                    onChange={handleSubCategoryChange} 
                    className="w-full bg-dark-900 border border-dark-700 p-2 text-white outline-none focus:border-gold-500 rounded"
                  >
                    <option value="4 Bedroom Flat">4 Bedroom Flat</option>
                    <option value="3 Bedroom Flat">3 Bedroom Flat</option>
                    <option value="2 Bedroom Flat">2 Bedroom Flat</option>
                    <option value="1 Bedroom Flat">1 Bedroom Flat</option>
                  </select>
                  <p className="text-xs text-gray-300 mt-1">Selecting a sub-category dynamically adjusts capacity and bed configuration options.</p>
                </div>
              )}

              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm text-gray-200 mb-1">Max Capacity</label>
                  <input type="number" required value={newRoom.capacity} onChange={e => setNewRoom({...newRoom, capacity: parseInt(e.target.value)})} className="w-full bg-dark-900 border border-dark-700 p-2 text-white outline-none focus:border-gold-500" />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm text-gray-200 mb-1">Size (sqm)</label>
                  <input type="number" value={newRoom.size_sqm} onChange={e => setNewRoom({...newRoom, size_sqm: parseInt(e.target.value)})} className="w-full bg-dark-900 border border-dark-700 p-2 text-white outline-none focus:border-gold-500" />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm text-gray-200 mb-1">Price/Night (Base)</label>
                  <input type="number" step="any" required value={newRoom.base_price_ngn} onChange={e => setNewRoom({...newRoom, base_price_ngn: parseFloat(e.target.value) || 0})} className="w-full bg-dark-900 border border-dark-700 p-2 text-white outline-none focus:border-gold-500" />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm text-gray-200 mb-1">Bed Configuration</label>
                  <select required value={newRoom.bed_configuration} onChange={e => setNewRoom({...newRoom, bed_configuration: e.target.value})} className="w-full bg-dark-900 border border-dark-700 p-2 text-white outline-none focus:border-gold-500">
                    {getBedConfigurationOptions().map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-200 mb-1">Pricing Model</label>
                  <select required value={newRoom.pricing_model || 'per_night'} onChange={e => setNewRoom({...newRoom, pricing_model: e.target.value})} className="w-full bg-dark-900 border border-dark-700 p-2 text-white outline-none focus:border-gold-500">
                    <option value="per_night">Per Night (Flat Rate)</option>
                    <option value="per_guest">Per Guest (Rate x Guests)</option>
                    <option value="per_room">Per Room (Group Bookings)</option>
                    <option value="per_occupancy">Per Occupancy (Base Rate + Extras)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-200 mb-1">Base Guests (for Occupancy Pricing)</label>
                  <input type="number" min="1" value={newRoom.base_guests || 2} onChange={e => setNewRoom({...newRoom, base_guests: parseInt(e.target.value)})} className="w-full bg-dark-900 border border-dark-700 p-2 text-white outline-none focus:border-gold-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-dark-700 pt-4">
                <div className="col-span-2">
                  <h3 className="text-md font-bold text-white mb-2">Booking Restrictions</h3>
                </div>
                <div>
                  <label className="block text-sm text-gray-200 mb-1">Minimum Stay (Days)</label>
                  <input type="number" min="1" required value={newRoom.min_stay_days} onChange={e => setNewRoom({...newRoom, min_stay_days: parseInt(e.target.value)})} className="w-full bg-dark-900 border border-dark-700 p-2 text-white outline-none focus:border-gold-500" />
                </div>
                <div>
                  <label className="block text-sm text-gray-200 mb-1">Maximum Stay (Days)</label>
                  <input type="number" min="1" required value={newRoom.max_stay_days} onChange={e => setNewRoom({...newRoom, max_stay_days: parseInt(e.target.value)})} className="w-full bg-dark-900 border border-dark-700 p-2 text-white outline-none focus:border-gold-500" />
                </div>
                
                <div className="col-span-2">
                  <label className="block text-sm text-gray-200 mb-2">Allowed Check-in Days</label>
                  <div className="flex flex-wrap gap-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => (
                      <label key={`in-${idx}`} className={`flex items-center justify-center w-12 h-8 rounded border cursor-pointer transition-colors ${newRoom.allowed_check_in_days.includes(idx) ? 'bg-gold-500 text-dark-900 font-bold border-gold-500' : 'bg-dark-900 text-gray-200 border-dark-700 hover:border-gray-500'}`}>
                        <input type="checkbox" className="hidden" checked={newRoom.allowed_check_in_days.includes(idx)} onChange={() => {
                          setNewRoom(prev => ({
                            ...prev,
                            allowed_check_in_days: prev.allowed_check_in_days.includes(idx) ? prev.allowed_check_in_days.filter(d => d !== idx) : [...prev.allowed_check_in_days, idx]
                          }))
                        }}/>
                        {day}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm text-gray-200 mb-2">Allowed Check-out Days</label>
                  <div className="flex flex-wrap gap-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => (
                      <label key={`out-${idx}`} className={`flex items-center justify-center w-12 h-8 rounded border cursor-pointer transition-colors ${newRoom.allowed_check_out_days.includes(idx) ? 'bg-gold-500 text-dark-900 font-bold border-gold-500' : 'bg-dark-900 text-gray-200 border-dark-700 hover:border-gray-500'}`}>
                        <input type="checkbox" className="hidden" checked={newRoom.allowed_check_out_days.includes(idx)} onChange={() => {
                          setNewRoom(prev => ({
                            ...prev,
                            allowed_check_out_days: prev.allowed_check_out_days.includes(idx) ? prev.allowed_check_out_days.filter(d => d !== idx) : [...prev.allowed_check_out_days, idx]
                          }))
                        }}/>
                        {day}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t border-dark-700 pt-4">
                <label className="block text-sm text-gray-200 mb-2">Room Features</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {featuresList.map((feat, idx) => (
                    <label key={idx} className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${newRoom.amenities.includes(feat) ? 'bg-gold-500/10 border-gold-500/50 text-gold-500' : 'bg-dark-900 border-dark-700 text-gray-200 hover:border-gray-500'}`}>
                      <input type="checkbox" checked={newRoom.amenities.includes(feat)} onChange={() => toggleFeature(feat)} className="hidden" />
                      <CheckCircle size={16} className={newRoom.amenities.includes(feat) ? 'opacity-100' : 'opacity-0'} />
                      <span className="text-xs font-semibold uppercase tracking-wider">{feat}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="border-t border-dark-700 pt-4">
                <label className="block text-sm text-gray-200 mb-2">Video Walkthrough URL (YouTube/Vimeo)</label>
                <input type="text" value={newRoom.video_url || ''} onChange={e => setNewRoom({...newRoom, video_url: e.target.value})} className="w-full bg-dark-900 border border-dark-700 p-2 text-white outline-none focus:border-gold-500 mb-4" placeholder="https://youtube.com/watch?v=..." />

                <label className="block text-sm text-gray-200 mb-2 border-b border-dark-700 pb-1">Media Gallery (Upload Multiple Images)</label>
                <input type="file" multiple accept="image/*" onChange={(e) => handleImageUpload(e, setNewRoom)} className="w-full bg-dark-900 border border-dark-700 p-2 text-gray-200 outline-none mb-2" />
                {newRoom.images && newRoom.images.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto py-2">
                    {newRoom.images.map((img, idx) => (
                      <div key={idx} className="relative w-20 h-20 flex-shrink-0 border border-dark-600 rounded">
                        <img src={img} className="w-full h-full object-cover rounded" />
                        <button type="button" onClick={() => setNewRoom(p => ({...p, images: p.images.filter((_,i)=>i!==idx)}))} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"><X size={12}/></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button type="submit" className="w-full btn-primary py-4 text-lg font-bold">{isEdit ? 'Update Room Configuration' : isBulkAdd ? `Generate ${bulkCount} Rooms` : 'Save Room'}</button>
            </form>
          </div>
        </div>
      )}

      {/* Property Modal has been removed */}

      {/* --- MODAL: CREATE/EDIT EVENT HALL --- */}
      {isHallModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-dark-800 border border-dark-700 w-full max-w-xl rounded-2xl shadow-2xl my-8 overflow-hidden">
            <div className="bg-dark-900 p-5 border-b border-dark-700 flex justify-between items-center">
              <h3 className="text-md font-bold text-white">{editingHall ? 'Edit Event Hall Profile' : 'Register New Event Hall'}</h3>
              <button onClick={() => { setIsHallModalOpen(false); setEditingHall(null); }} className="text-gray-200 hover:text-white"><X size={20}/></button>
            </div>

            <form onSubmit={handleSaveHall} className="p-6 space-y-4 text-left">
              <div>
                <label className="block text-xs text-gray-200 font-bold mb-1">Hall Name *</label>
                <input 
                  type="text" 
                  required
                  value={hallForm.name}
                  onChange={e => setHallForm(prev => ({ ...prev, name: e.target.value }))}
                  className="bg-dark-900 border border-dark-700 w-full px-3 py-2.5 rounded-xl text-white outline-none focus:border-brand-500"
                  placeholder="e.g. Conference Room A"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-200 font-bold mb-1">Max Capacity (Pax) *</label>
                  <input 
                    type="number" 
                    required
                    min="1"
                    value={hallForm.capacity}
                    onChange={e => setHallForm(prev => ({ ...prev, capacity: e.target.value }))}
                    className="bg-dark-900 border border-dark-700 w-full px-3 py-2.5 rounded-xl text-white outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-200 font-bold mb-1">Size (Sqm)</label>
                  <input 
                    type="number" 
                    min="1"
                    value={hallForm.size_sqm}
                    onChange={e => setHallForm(prev => ({ ...prev, size_sqm: e.target.value }))}
                    className="bg-dark-900 border border-dark-700 w-full px-3 py-2.5 rounded-xl text-white outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-200 font-bold mb-1">Daily Base Rate (₦) *</label>
                  <input 
                    type="number" 
                    required
                    min="0"
                    value={hallForm.base_price_ngn}
                    onChange={e => setHallForm(prev => ({ ...prev, base_price_ngn: e.target.value }))}
                    className="bg-dark-900 border border-dark-700 w-full px-3 py-2.5 rounded-xl text-white outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-200 font-bold mb-1">Hourly Base Rate (₦) *</label>
                  <input 
                    type="number" 
                    required
                    min="0"
                    value={hallForm.hourly_price_ngn}
                    onChange={e => setHallForm(prev => ({ ...prev, hourly_price_ngn: e.target.value }))}
                    className="bg-dark-900 border border-dark-700 w-full px-3 py-2.5 rounded-xl text-white outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-200 font-bold mb-1">Description</label>
                <textarea 
                  value={hallForm.description}
                  onChange={e => setHallForm(prev => ({ ...prev, description: e.target.value }))}
                  className="bg-dark-900 border border-dark-700 w-full px-3 py-2.5 rounded-xl text-white outline-none focus:border-brand-500 h-20"
                  placeholder="Describe the hall, location inside premises, layout configs..."
                />
              </div>

              <div>
                <label className="block text-xs text-gray-200 font-bold mb-1">Amenities (Comma separated)</label>
                <input 
                  type="text" 
                  value={hallForm.amenities}
                  onChange={e => setHallForm(prev => ({ ...prev, amenities: e.target.value }))}
                  className="bg-dark-900 border border-dark-700 w-full px-3 py-2.5 rounded-xl text-white outline-none focus:border-brand-500"
                  placeholder="Projector, PA System, Smart Screen, Coffee Station"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-200 font-bold mb-1">Image URL</label>
                <input 
                  type="text" 
                  value={hallForm.image_url}
                  onChange={e => setHallForm(prev => ({ ...prev, image_url: e.target.value }))}
                  className="bg-dark-900 border border-dark-700 w-full px-3 py-2.5 rounded-xl text-white outline-none focus:border-brand-500"
                  placeholder="https://images.unsplash.com/..."
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox" 
                  id="hallActive"
                  checked={hallForm.is_active}
                  onChange={e => setHallForm(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="rounded bg-dark-900 border-dark-700 text-brand-500 focus:ring-0 focus:ring-offset-0"
                />
                <label htmlFor="hallActive" className="text-xs text-gray-200 font-bold cursor-pointer">Hall is Active & Bookable</label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-dark-700 mt-2">
                <button 
                  type="button" 
                  onClick={() => { setIsHallModalOpen(false); setEditingHall(null); }}
                  className="px-4 py-2 border border-dark-700 text-gray-200 hover:text-white rounded-lg text-xs font-bold"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-bold active:scale-95 transition-all"
                >
                  {isSaving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Walk-in Modal */}
      {isWalkinModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-700 p-8 w-full max-w-md shadow-2xl relative animate-in zoom-in-95 text-center">
            <button onClick={() => setIsWalkinModalOpen(false)} className="absolute top-4 right-4 text-gray-200 hover:text-white"><X size={24}/></button>
            <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Walk-in Reservation</h2>
            <p className="text-gray-200 mb-6">To process a walk-in, redirecting you to the master reservation terminal.</p>
            <button onClick={() => { setIsWalkinModalOpen(false); window.location.href = '/admin/frontdesk'; }} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded transition-colors">Go to Front Desk Terminal</button>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminRooms;
