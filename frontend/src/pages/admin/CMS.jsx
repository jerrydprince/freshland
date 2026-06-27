import React, { useState, useEffect } from 'react';
import { Image, FileText, MessageSquare, HelpCircle, Edit, Plus, Trash2, CheckCircle, XCircle, X, Code, UploadCloud, Link as LinkIcon, MoveUp, MoveDown, LayoutTemplate } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { clearCache } from '../../utils/cache';

const AdminCMS = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState('pages');
  const [loading, setLoading] = useState(false);

  // --- PAGES & BLOCK BUILDER STATE ---
  const [pages, setPages] = useState([]);
  const [isPageModalOpen, setIsPageModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentPageId, setCurrentPageId] = useState(null);
  
  const defaultPageForm = {
    title: '', slug: '', is_published: false, page_type: 'landing_page',
    meta_title: '', meta_description: '', seo_keywords: '',
    blocks: [] // The elementor-style sections
  };
  const [pageForm, setPageForm] = useState(defaultPageForm);
  const [activeSectionTab, setActiveSectionTab] = useState('content'); // 'content' or 'seo'

  // --- GALLERY STATE ---
  const [gallery, setGallery] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  
  // --- WIDGET STATE ---
  const [widgetTheme, setWidgetTheme] = useState('dark');
  const [widgetColor, setWidgetColor] = useState('#DF6853'); // Gold/Brand color

  // --- FRONTEND CONTENT STATE ---
  const [frontendContent, setFrontendContent] = useState({
    cms_home_hero_title: 'Experience True Luxury',
    cms_home_hero_subtitle: 'Elevate your stay in the heart of the city with our premium shortlets.',
    cms_home_hero_bg_1: '',
    cms_home_about_title: 'Redefining the standard of luxury living.',
    cms_home_about_text_1: 'Nestled in the most prestigious neighborhood, Luxe offers an unparalleled living experience.',
    cms_home_about_text_2: 'Every corner is thoughtfully designed to anticipate your needs.',
    cms_home_about_img_1: '',
    cms_home_about_img_2: '',
    cms_home_cta_title: 'Ready to experience the exceptional?',
    cms_home_cta_subtitle: 'Book your stay today and step into a world of comfort and luxury.',
    cms_home_cta_bg: '',
    cms_home_hero_bg_2: '',
    cms_home_hero_title_2: 'Designed for Comfort',
    cms_home_hero_subtitle_2: 'Every detail meticulously crafted for your ultimate relaxation.',
    cms_home_hero_bg_3: '',
    cms_home_hero_title_3: 'Your Private Sanctuary',
    cms_home_hero_subtitle_3: 'Exclusive amenities and serene environments await.',
    cms_about_hero_bg: '',
    cms_about_title: 'Our Story',
    cms_about_subtitle: 'Redefining luxury living and hospitality, one exquisite apartment at a time.',
    cms_about_vision_title: 'Elevating the standard of modern hospitality.',
    cms_about_vision_text_1: 'Welcome to Luxe Apartments, where we redefine the art of fine living.',
    cms_about_vision_text_2: 'Our journey began with a simple yet ambitious goal...',
    cms_about_vision_text_3: 'Every detail has been meticulously selected...',
    cms_about_img_1: '',
    cms_about_img_2: '',
    cms_about_years: '10+',
    cms_amenities_list: '[\n      {"title": "✨ Netflix", "desc": "Premium Netflix streaming subscription for unlimited movies and show options."},\n      {"title": "✨ Luxuriously furnished", "desc": "Exquisite interior design with premium, high-end contemporary furnishings."},\n      {"title": "✨ PS5", "desc": "PlayStation 5 gaming console equipped with popular games for your entertainment."},\n      {"title": "✨ Secured, Serene and cozy Environment", "desc": "Located in a highly secured, peaceful, and cozy neighborhood."},\n      {"title": "✨ Excellent road network", "desc": "Accessible tarred roads linking to key areas smoothly."},\n      {"title": "✨ 24/7 light and running water", "desc": "Uninterrupted power supply with backup generators and continuous clean water access."},\n      {"title": "✨ Close proximity to all popular hotspots in Abuja", "desc": "Close proximity to all popular hotspots, restaurants, and shopping centers in Abuja."}\n    ]'
  });

  const tabs = [
    { id: 'pages', name: 'Page Builder', icon: <LayoutTemplate size={18} /> },
    { id: 'frontend', name: 'Global Content', icon: <FileText size={18} /> },
    { id: 'gallery', name: 'File Gallery', icon: <Image size={18} /> },
    { id: 'widget', name: 'Booking Widget', icon: <Code size={18} /> },
    { id: 'testimonials', name: 'Testimonials', icon: <MessageSquare size={18} /> },
    { id: 'faq', name: 'FAQ', icon: <HelpCircle size={18} /> },
  ];

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'pages') {
        const { data } = await supabase.from('cms_pages').select('*').order('updated_at', { ascending: false });
        if (data) setPages(data);
      } else if (activeTab === 'gallery') {
        const { data } = await supabase.from('cms_gallery').select('*').order('id', { ascending: false });
        if (data) setGallery(data);
      } else if (activeTab === 'frontend') {
        const { data } = await supabase.from('system_settings').select('*').like('setting_key', 'cms_%');
        if (data && data.length > 0) {
          const contentMap = {};
          data.forEach(item => contentMap[item.setting_key] = item.setting_value);
          setFrontendContent(prev => ({ ...prev, ...contentMap }));
        }
      }
    } catch (e) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFrontendContent = async (e) => {
    e.preventDefault();
    const keys = Object.keys(frontendContent);
    let successCount = 0;
    
    for (const key of keys) {
      const { data: exists } = await supabase.from('system_settings').select('id').eq('setting_key', key).single();
      let err;
      if (exists) {
        const { error } = await supabase.from('system_settings').update({ setting_value: frontendContent[key] }).eq('setting_key', key);
        err = error;
      } else {
        const { error } = await supabase.from('system_settings').insert([{ setting_key: key, setting_value: frontendContent[key] }]);
        err = error;
      }
      if (!err) successCount++;
    }
    
    clearCache('cmsContent');
    if (successCount === keys.length) toast.success('Content updated successfully');
    else toast.error('Some content failed to update');
  };

  // --- PAGE BUILDER LOGIC ---
  const togglePageStatus = async (id, currentStatus) => {
    const { error } = await supabase.from('cms_pages').update({ is_published: !currentStatus }).eq('id', id);
    if (!error) { 
      clearCache('cmsContent');
      toast.success('Status updated'); 
      fetchData(); 
    }
  };

  const openAddPageModal = () => {
    setIsEdit(false);
    setCurrentPageId(null);
    setPageForm(defaultPageForm);
    setActiveSectionTab('content');
    setIsPageModalOpen(true);
  };

  const openEditPageModal = (page) => {
    setIsEdit(true);
    setCurrentPageId(page.id);
    setPageForm({
      title: page.title || '',
      slug: page.slug || '',
      is_published: page.is_published,
      page_type: page.page_type || 'landing_page',
      meta_title: page.meta_title || '',
      meta_description: page.meta_description || '',
      seo_keywords: page.seo_keywords || '',
      blocks: Array.isArray(page.content) ? page.content : [] // Parse JSONB array
    });
    setActiveSectionTab('content');
    setIsPageModalOpen(true);
  };

  const addBlock = (type) => {
    const newBlock = { id: crypto.randomUUID(), type, data: {} };
    if (type === 'hero') newBlock.data = { headline: 'Welcome', subheadline: 'To Luxury', bg_image: '' };
    if (type === 'text') newBlock.data = { text: 'Enter your rich text here...' };
    if (type === 'rooms') newBlock.data = { limit: 3, title: 'Featured Rooms' };
    
    setPageForm(prev => ({ ...prev, blocks: [...prev.blocks, newBlock] }));
  };

  const updateBlock = (id, newData) => {
    setPageForm(prev => ({
      ...prev,
      blocks: prev.blocks.map(b => b.id === id ? { ...b, data: { ...b.data, ...newData } } : b)
    }));
  };

  const removeBlock = (id) => {
    setPageForm(prev => ({ ...prev, blocks: prev.blocks.filter(b => b.id !== id) }));
  };

  const moveBlock = (index, direction) => {
    const newBlocks = [...pageForm.blocks];
    if (direction === 'up' && index > 0) {
      [newBlocks[index - 1], newBlocks[index]] = [newBlocks[index], newBlocks[index - 1]];
    } else if (direction === 'down' && index < newBlocks.length - 1) {
      [newBlocks[index + 1], newBlocks[index]] = [newBlocks[index], newBlocks[index + 1]];
    }
    setPageForm(prev => ({ ...prev, blocks: newBlocks }));
  };

  const handleSavePage = async () => {
    if (!pageForm.title || !pageForm.slug) return toast.error("Title and Slug are required.");
    
    const payload = {
      title: pageForm.title,
      slug: pageForm.slug,
      is_published: pageForm.is_published,
      page_type: pageForm.page_type,
      meta_title: pageForm.meta_title,
      meta_description: pageForm.meta_description,
      seo_keywords: pageForm.seo_keywords,
      content: pageForm.blocks // Saving the blocks array to the JSONB content column
    };

    try {
      if (isEdit) {
        await supabase.from('cms_pages').update(payload).eq('id', currentPageId);
        toast.success("Page updated!");
      } else {
        await supabase.from('cms_pages').insert([payload]);
        toast.success("Page created!");
      }
      clearCache('cmsContent');
      setIsPageModalOpen(false);
      fetchData();
    } catch(e) { toast.error("Save failed."); }
  };

  // --- GALLERY LOGIC ---
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    
    try {
      // 1. Upload to Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `uploads/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('gallery_images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('gallery_images')
        .getPublicUrl(filePath);

      // 3. Save to cms_gallery DB
      await supabase.from('cms_gallery').insert({
        image_url: publicUrl,
        caption: file.name
      });

      toast.success("Image uploaded!");
      fetchData();
    } catch(err) {
      console.error(err);
      toast.error(`Upload failed. Ensure the storage bucket "gallery_images" exists and allows public uploads.`);
    } finally {
      setIsUploading(false);
    }
  };

  const deleteImage = async (img) => {
    try {
      if (img.image_url) {
        const filePath = img.image_url.split('/gallery_images/')[1];
        if (filePath) {
          await supabase.storage.from('gallery_images').remove([filePath]);
        }
      }
      await supabase.from('cms_gallery').delete().eq('id', img.id);
      toast.success("Deleted");
      fetchData();
    } catch (e) { toast.error("Delete failed"); }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const handleDirectImageUpload = async (e, stateKey) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    const loadingToast = toast.loading('Uploading image...');
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `uploads/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('gallery_images').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('gallery_images').getPublicUrl(filePath);
      
      setFrontendContent(prev => ({ ...prev, [stateKey]: publicUrl }));
      toast.success('Image uploaded and applied!', { id: loadingToast });
      
      // Also save to gallery silently
      supabase.from('cms_gallery').insert({
        image_url: publicUrl, caption: file.name
      }).then(() => fetchData());
    } catch (err) {
      toast.error('Upload failed.', { id: loadingToast });
    } finally {
      setIsUploading(false);
    }
  };

  // --- WIDGET LOGIC ---
  const generatedWidgetCode = `
<!-- Luxe PMS Booking Widget -->
<div id="luxe-booking-widget" data-theme="${widgetTheme}" data-color="${widgetColor}"></div>
<script src="https://your-luxe-pms-domain.com/widget.js" async></script>
<!-- End Luxe PMS Widget -->
  `.trim();


  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">Website CMS & Portal</h1>
          <p className="text-gray-400 mt-1">Manage pages, uploads, SEO, and booking widgets.</p>
        </div>
        {activeTab === 'pages' && (
          <button onClick={openAddPageModal} className="btn-primary py-2 px-4 text-sm flex items-center gap-2">
            <Plus size={18}/> Build New Page
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-dark-700 mb-8 overflow-x-auto">
        {tabs.map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-4 font-bold transition-colors whitespace-nowrap ${activeTab === tab.id ? 'text-brand-500 border-b-2 border-brand-500' : 'text-gray-400 hover:text-white'}`}
          >
            {tab.icon} {tab.name}
          </button>
        ))}
      </div>

      <div className="bg-dark-800 border border-dark-700 rounded-lg min-h-[500px]">
        
        {/* PAGES TAB */}
        {activeTab === 'pages' && (
          <div className="p-6">
            <table className="w-full text-left text-sm">
              <thead className="bg-dark-900 border-b border-dark-700 text-gray-400">
                <tr>
                  <th className="p-4 font-semibold">Page Title</th>
                  <th className="p-4 font-semibold">URL Slug</th>
                  <th className="p-4 font-semibold">Type</th>
                  <th className="p-4 font-semibold">Status</th>
                  <th className="p-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {pages.length === 0 ? (
                  <tr><td colSpan="5" className="p-8 text-center text-gray-500">No pages built yet.</td></tr>
                ) : pages.map(page => (
                  <tr key={page.id} className="hover:bg-dark-700/30 transition-colors">
                    <td className="p-4 font-bold text-white">{page.title}</td>
                    <td className="p-4 text-gray-400">/{page.slug}</td>
                    <td className="p-4 text-gray-400 uppercase text-xs tracking-wider">{page.page_type.replace('_', ' ')}</td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${page.is_published ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                        {page.is_published ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td className="p-4 text-right flex justify-end gap-3">
                      <button onClick={() => togglePageStatus(page.id, page.is_published)} className="text-gray-400 hover:text-white transition-colors" title="Toggle Publish">
                        {page.is_published ? <XCircle size={16}/> : <CheckCircle size={16}/>}
                      </button>
                      <button onClick={() => openEditPageModal(page)} className="text-brand-500 hover:text-brand-400 transition-colors" title="Edit Page Builder">
                        <Edit size={16}/>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* GALLERY TAB */}
        {activeTab === 'gallery' && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white">Media Library</h3>
              <label className="btn-primary py-2 px-4 text-sm flex items-center gap-2 cursor-pointer">
                <UploadCloud size={18}/> {isUploading ? 'Uploading...' : 'Upload Image'}
                <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={isUploading}/>
              </label>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {gallery.map(img => (
                <div key={img.id} className="relative group aspect-square bg-dark-900 border border-dark-700 rounded overflow-hidden">
                  <img src={img.image_url} alt={img.alt_text || 'Gallery Image'} className="w-full h-full object-cover opacity-80 group-hover:scale-110 transition-transform duration-500"/>
                  <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 p-4">
                    <button onClick={() => copyToClipboard(img.image_url)} className="flex items-center gap-2 text-xs bg-dark-700 hover:bg-brand-500 text-white px-3 py-1 rounded w-full justify-center transition-colors">
                      <LinkIcon size={12}/> Copy URL
                    </button>
                    <button onClick={() => deleteImage(img)} className="flex items-center gap-2 text-xs bg-dark-700 hover:bg-red-500 text-white px-3 py-1 rounded w-full justify-center transition-colors">
                      <Trash2 size={12}/> Delete
                    </button>
                  </div>
                </div>
              ))}
              {gallery.length === 0 && !isUploading && (
                <div className="col-span-full py-12 text-center text-gray-500 border-2 border-dashed border-dark-700 rounded">
                  No images in the gallery yet. Click 'Upload Image' to add some!
                </div>
              )}
            </div>
          </div>
        )}

        {/* WIDGET GENERATOR TAB */}
        {activeTab === 'widget' && (
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-bold text-white mb-2">Embeddable Booking Engine</h3>
              <p className="text-gray-400 mb-8 text-sm">Configure the look and feel of your external booking widget, then copy the generated code into your WordPress, Wix, or custom website.</p>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm text-gray-400 mb-2 font-bold">Widget Theme</label>
                  <div className="flex gap-4">
                    <label className={`flex-1 p-4 border rounded cursor-pointer text-center font-bold ${widgetTheme === 'dark' ? 'border-brand-500 bg-dark-900 text-white' : 'border-dark-700 text-gray-500 hover:border-gray-500'}`}>
                      <input type="radio" name="theme" className="hidden" checked={widgetTheme === 'dark'} onChange={() => setWidgetTheme('dark')}/>
                      Dark Mode
                    </label>
                    <label className={`flex-1 p-4 border rounded cursor-pointer text-center font-bold ${widgetTheme === 'light' ? 'border-brand-500 bg-dark-900 text-white' : 'border-dark-700 text-gray-500 hover:border-gray-500'}`}>
                      <input type="radio" name="theme" className="hidden" checked={widgetTheme === 'light'} onChange={() => setWidgetTheme('light')}/>
                      Light Mode
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2 font-bold">Brand Hex Color</label>
                  <div className="flex gap-4 items-center">
                    <input type="color" value={widgetColor} onChange={e => setWidgetColor(e.target.value)} className="w-12 h-12 rounded cursor-pointer bg-dark-900 border border-dark-700 p-1"/>
                    <input type="text" value={widgetColor} onChange={e => setWidgetColor(e.target.value)} className="bg-dark-900 border border-dark-700 p-3 rounded text-white outline-none focus:border-brand-500 flex-1 font-mono"/>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-dark-900 border border-dark-700 rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-bold text-white flex items-center gap-2"><Code size={18} className="text-brand-500"/> Generated Code Snippet</h4>
                <button onClick={() => copyToClipboard(generatedWidgetCode)} className="text-xs bg-dark-700 hover:bg-brand-500 px-3 py-1.5 rounded transition-colors font-bold">Copy HTML</button>
              </div>
              <pre className="bg-black text-green-400 p-4 rounded text-sm overflow-x-auto border border-dark-800">
                <code>{generatedWidgetCode}</code>
              </pre>
              <div className="mt-6 p-4 border border-brand-500/30 bg-brand-500/10 rounded-lg">
                <h5 className="font-bold text-brand-500 text-sm mb-1">Integration Instructions</h5>
                <p className="text-xs text-gray-400">Place this HTML snippet wherever you want the booking search bar to appear on your external website. The widget script will automatically render the UI and connect to your PMS database securely.</p>
              </div>
            </div>
          </div>
        )}

        {/* OTHER TABS (Testimonials/FAQ placeholders) */}
        {(activeTab === 'testimonials' || activeTab === 'faq') && (
           <div className="p-12 text-center text-gray-500">
             <MessageSquare size={48} className="mx-auto mb-4 opacity-20"/>
             This section relies on basic text storage and is managed similarly. Use the Page Builder for rich content.
           </div>
        )}

        {/* FRONTEND GLOBAL CONTENT TAB */}
        {activeTab === 'frontend' && (
          <div className="p-6">
            <h3 className="text-xl font-bold text-white mb-2">Global Website Content</h3>
            <p className="text-gray-400 mb-8 text-sm">Update text and images across the public facing website without touching code.</p>
            
            <form onSubmit={handleSaveFrontendContent} className="space-y-8 max-w-4xl">
              
              <div className="bg-dark-900 border border-dark-700 rounded-lg p-6">
                <h4 className="font-bold text-white mb-4 border-b border-dark-700 pb-2 flex justify-between items-center">
                  <span>Home Page: Hero Section</span>
                  <span className="text-xs bg-dark-700 px-2 py-1 rounded">3 Slides Supported</span>
                </h4>
                
                {/* Slide 1 */}
                <div className="space-y-4 mb-8 pb-6 border-b border-dark-800">
                  <h5 className="font-bold text-gray-400 text-sm">Slide 1 (Main)</h5>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Headline</label>
                    <input type="text" value={frontendContent.cms_home_hero_title} onChange={e => setFrontendContent({...frontendContent, cms_home_hero_title: e.target.value})} className="w-full bg-dark-800 text-white border border-dark-700 rounded p-3 focus:border-brand-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Subheadline</label>
                    <textarea rows="2" value={frontendContent.cms_home_hero_subtitle} onChange={e => setFrontendContent({...frontendContent, cms_home_hero_subtitle: e.target.value})} className="w-full bg-dark-800 text-white border border-dark-700 rounded p-3 focus:border-brand-500 outline-none"></textarea>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Background Image URL (Slide 1)</label>
                    <div className="flex gap-2">
                      <input type="text" value={frontendContent.cms_home_hero_bg_1} onChange={e => setFrontendContent({...frontendContent, cms_home_hero_bg_1: e.target.value})} className="flex-1 bg-dark-800 text-blue-400 font-mono text-sm border border-dark-700 rounded p-3 focus:border-brand-500 outline-none" />
                      <label className="bg-dark-700 hover:bg-brand-500 text-white px-4 flex items-center justify-center rounded cursor-pointer transition-colors font-bold whitespace-nowrap">
                        <UploadCloud size={16} className="mr-2"/> Upload
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleDirectImageUpload(e, 'cms_home_hero_bg_1')} disabled={isUploading} />
                      </label>
                    </div>
                  </div>
                </div>

                {/* Slide 2 */}
                <div className="space-y-4 mb-8 pb-6 border-b border-dark-800">
                  <h5 className="font-bold text-gray-400 text-sm">Slide 2</h5>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Headline</label>
                    <input type="text" value={frontendContent.cms_home_hero_title_2} onChange={e => setFrontendContent({...frontendContent, cms_home_hero_title_2: e.target.value})} className="w-full bg-dark-800 text-white border border-dark-700 rounded p-3 focus:border-brand-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Subheadline</label>
                    <textarea rows="2" value={frontendContent.cms_home_hero_subtitle_2} onChange={e => setFrontendContent({...frontendContent, cms_home_hero_subtitle_2: e.target.value})} className="w-full bg-dark-800 text-white border border-dark-700 rounded p-3 focus:border-brand-500 outline-none"></textarea>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Background Image URL (Slide 2)</label>
                    <div className="flex gap-2">
                      <input type="text" value={frontendContent.cms_home_hero_bg_2} onChange={e => setFrontendContent({...frontendContent, cms_home_hero_bg_2: e.target.value})} className="flex-1 bg-dark-800 text-blue-400 font-mono text-sm border border-dark-700 rounded p-3 focus:border-brand-500 outline-none" />
                      <label className="bg-dark-700 hover:bg-brand-500 text-white px-4 flex items-center justify-center rounded cursor-pointer transition-colors font-bold whitespace-nowrap">
                        <UploadCloud size={16} className="mr-2"/> Upload
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleDirectImageUpload(e, 'cms_home_hero_bg_2')} disabled={isUploading} />
                      </label>
                    </div>
                  </div>
                </div>

                {/* Slide 3 */}
                <div className="space-y-4">
                  <h5 className="font-bold text-gray-400 text-sm">Slide 3</h5>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Headline</label>
                    <input type="text" value={frontendContent.cms_home_hero_title_3} onChange={e => setFrontendContent({...frontendContent, cms_home_hero_title_3: e.target.value})} className="w-full bg-dark-800 text-white border border-dark-700 rounded p-3 focus:border-brand-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Subheadline</label>
                    <textarea rows="2" value={frontendContent.cms_home_hero_subtitle_3} onChange={e => setFrontendContent({...frontendContent, cms_home_hero_subtitle_3: e.target.value})} className="w-full bg-dark-800 text-white border border-dark-700 rounded p-3 focus:border-brand-500 outline-none"></textarea>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Background Image URL (Slide 3)</label>
                    <div className="flex gap-2">
                      <input type="text" value={frontendContent.cms_home_hero_bg_3} onChange={e => setFrontendContent({...frontendContent, cms_home_hero_bg_3: e.target.value})} className="flex-1 bg-dark-800 text-blue-400 font-mono text-sm border border-dark-700 rounded p-3 focus:border-brand-500 outline-none" />
                      <label className="bg-dark-700 hover:bg-brand-500 text-white px-4 flex items-center justify-center rounded cursor-pointer transition-colors font-bold whitespace-nowrap">
                        <UploadCloud size={16} className="mr-2"/> Upload
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleDirectImageUpload(e, 'cms_home_hero_bg_3')} disabled={isUploading} />
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-dark-900 border border-dark-700 rounded-lg p-6">
                <h4 className="font-bold text-white mb-4 border-b border-dark-700 pb-2">Home Page: About Luxe</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Title</label>
                    <input type="text" value={frontendContent.cms_home_about_title} onChange={e => setFrontendContent({...frontendContent, cms_home_about_title: e.target.value})} className="w-full bg-dark-800 text-white border border-dark-700 rounded p-3 focus:border-brand-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Paragraph 1</label>
                    <textarea rows="3" value={frontendContent.cms_home_about_text_1} onChange={e => setFrontendContent({...frontendContent, cms_home_about_text_1: e.target.value})} className="w-full bg-dark-800 text-white border border-dark-700 rounded p-3 focus:border-brand-500 outline-none"></textarea>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Paragraph 2</label>
                    <textarea rows="3" value={frontendContent.cms_home_about_text_2} onChange={e => setFrontendContent({...frontendContent, cms_home_about_text_2: e.target.value})} className="w-full bg-dark-800 text-white border border-dark-700 rounded p-3 focus:border-brand-500 outline-none"></textarea>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Image 1 URL</label>
                      <div className="flex gap-2">
                        <input type="text" value={frontendContent.cms_home_about_img_1} onChange={e => setFrontendContent({...frontendContent, cms_home_about_img_1: e.target.value})} className="flex-1 bg-dark-800 text-blue-400 font-mono text-xs border border-dark-700 rounded p-3 focus:border-brand-500 outline-none" />
                        <label className="bg-dark-700 hover:bg-brand-500 text-white px-3 flex items-center justify-center rounded cursor-pointer transition-colors font-bold">
                          <UploadCloud size={14}/>
                          <input type="file" className="hidden" accept="image/*" onChange={(e) => handleDirectImageUpload(e, 'cms_home_about_img_1')} disabled={isUploading} />
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Image 2 URL</label>
                      <div className="flex gap-2">
                        <input type="text" value={frontendContent.cms_home_about_img_2} onChange={e => setFrontendContent({...frontendContent, cms_home_about_img_2: e.target.value})} className="flex-1 bg-dark-800 text-blue-400 font-mono text-xs border border-dark-700 rounded p-3 focus:border-brand-500 outline-none" />
                        <label className="bg-dark-700 hover:bg-brand-500 text-white px-3 flex items-center justify-center rounded cursor-pointer transition-colors font-bold">
                          <UploadCloud size={14}/>
                          <input type="file" className="hidden" accept="image/*" onChange={(e) => handleDirectImageUpload(e, 'cms_home_about_img_2')} disabled={isUploading} />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-dark-900 border border-dark-700 rounded-lg p-6">
                <h4 className="font-bold text-white mb-4 border-b border-dark-700 pb-2">Home Page: Call To Action (Bottom)</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">CTA Headline</label>
                    <input type="text" value={frontendContent.cms_home_cta_title} onChange={e => setFrontendContent({...frontendContent, cms_home_cta_title: e.target.value})} className="w-full bg-dark-800 text-white border border-dark-700 rounded p-3 focus:border-brand-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">CTA Subheadline</label>
                    <input type="text" value={frontendContent.cms_home_cta_subtitle} onChange={e => setFrontendContent({...frontendContent, cms_home_cta_subtitle: e.target.value})} className="w-full bg-dark-800 text-white border border-dark-700 rounded p-3 focus:border-brand-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Background Image URL</label>
                    <div className="flex gap-2">
                      <input type="text" value={frontendContent.cms_home_cta_bg} onChange={e => setFrontendContent({...frontendContent, cms_home_cta_bg: e.target.value})} className="flex-1 bg-dark-800 text-blue-400 font-mono text-sm border border-dark-700 rounded p-3 focus:border-brand-500 outline-none" />
                      <label className="bg-dark-700 hover:bg-brand-500 text-white px-4 flex items-center justify-center rounded cursor-pointer transition-colors font-bold whitespace-nowrap">
                        <UploadCloud size={16} className="mr-2"/> Upload
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleDirectImageUpload(e, 'cms_home_cta_bg')} disabled={isUploading} />
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-dark-900 border border-dark-700 rounded-lg p-6">
                <h4 className="font-bold text-white mb-4 border-b border-dark-700 pb-2">About Us Page</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Hero Background Image</label>
                    <div className="flex gap-2">
                      <input type="text" value={frontendContent.cms_about_hero_bg} onChange={e => setFrontendContent({...frontendContent, cms_about_hero_bg: e.target.value})} className="flex-1 bg-dark-800 text-blue-400 font-mono text-sm border border-dark-700 rounded p-3 focus:border-brand-500 outline-none" />
                      <label className="bg-dark-700 hover:bg-brand-500 text-white px-4 flex items-center justify-center rounded cursor-pointer transition-colors font-bold whitespace-nowrap">
                        <UploadCloud size={16} className="mr-2"/> Upload
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleDirectImageUpload(e, 'cms_about_hero_bg')} disabled={isUploading} />
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Hero Title</label>
                    <input type="text" value={frontendContent.cms_about_title} onChange={e => setFrontendContent({...frontendContent, cms_about_title: e.target.value})} className="w-full bg-dark-800 text-white border border-dark-700 rounded p-3 focus:border-brand-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Hero Subtitle</label>
                    <textarea rows="2" value={frontendContent.cms_about_subtitle} onChange={e => setFrontendContent({...frontendContent, cms_about_subtitle: e.target.value})} className="w-full bg-dark-800 text-white border border-dark-700 rounded p-3 focus:border-brand-500 outline-none"></textarea>
                  </div>
                  
                  <div className="pt-4 border-t border-dark-800">
                    <h5 className="font-bold text-gray-400 text-sm mb-4">The Vision Section</h5>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Vision Title</label>
                        <input type="text" value={frontendContent.cms_about_vision_title} onChange={e => setFrontendContent({...frontendContent, cms_about_vision_title: e.target.value})} className="w-full bg-dark-800 text-white border border-dark-700 rounded p-3 focus:border-brand-500 outline-none" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Paragraph 1</label>
                        <textarea rows="3" value={frontendContent.cms_about_vision_text_1} onChange={e => setFrontendContent({...frontendContent, cms_about_vision_text_1: e.target.value})} className="w-full bg-dark-800 text-white border border-dark-700 rounded p-3 focus:border-brand-500 outline-none"></textarea>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Paragraph 2</label>
                        <textarea rows="3" value={frontendContent.cms_about_vision_text_2} onChange={e => setFrontendContent({...frontendContent, cms_about_vision_text_2: e.target.value})} className="w-full bg-dark-800 text-white border border-dark-700 rounded p-3 focus:border-brand-500 outline-none"></textarea>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Paragraph 3</label>
                        <textarea rows="3" value={frontendContent.cms_about_vision_text_3} onChange={e => setFrontendContent({...frontendContent, cms_about_vision_text_3: e.target.value})} className="w-full bg-dark-800 text-white border border-dark-700 rounded p-3 focus:border-brand-500 outline-none"></textarea>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-1">Vision Image 1 URL</label>
                          <div className="flex gap-2">
                            <input type="text" value={frontendContent.cms_about_img_1} onChange={e => setFrontendContent({...frontendContent, cms_about_img_1: e.target.value})} className="flex-1 bg-dark-800 text-blue-400 font-mono text-xs border border-dark-700 rounded p-3 focus:border-brand-500 outline-none" />
                            <label className="bg-dark-700 hover:bg-brand-500 text-white px-3 flex items-center justify-center rounded cursor-pointer transition-colors font-bold">
                              <UploadCloud size={14}/>
                              <input type="file" className="hidden" accept="image/*" onChange={(e) => handleDirectImageUpload(e, 'cms_about_img_1')} disabled={isUploading} />
                            </label>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-1">Vision Image 2 URL</label>
                          <div className="flex gap-2">
                            <input type="text" value={frontendContent.cms_about_img_2} onChange={e => setFrontendContent({...frontendContent, cms_about_img_2: e.target.value})} className="flex-1 bg-dark-800 text-blue-400 font-mono text-xs border border-dark-700 rounded p-3 focus:border-brand-500 outline-none" />
                            <label className="bg-dark-700 hover:bg-brand-500 text-white px-3 flex items-center justify-center rounded cursor-pointer transition-colors font-bold">
                              <UploadCloud size={14}/>
                              <input type="file" className="hidden" accept="image/*" onChange={(e) => handleDirectImageUpload(e, 'cms_about_img_2')} disabled={isUploading} />
                            </label>
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Years of Excellence (Badge)</label>
                        <input type="text" value={frontendContent.cms_about_years} onChange={e => setFrontendContent({...frontendContent, cms_about_years: e.target.value})} className="w-full bg-dark-800 text-white border border-dark-700 rounded p-3 focus:border-brand-500 outline-none max-w-xs" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-dark-900 border border-dark-700 rounded-lg p-6">
                <h4 className="font-bold text-white mb-4 border-b border-dark-700 pb-2">Amenities Page (Global Facilities)</h4>
                <div className="space-y-4">
                  <p className="text-sm text-gray-400 mb-4">Manage the premium amenities listed on the public Amenities page. Icons are pre-selected based on keywords.</p>
                  
                  {(() => {
                    let parsedAmenities = [];
                    try { parsedAmenities = JSON.parse(frontendContent.cms_amenities_list || '[]'); } catch(e){}
                    if (!Array.isArray(parsedAmenities)) parsedAmenities = [];

                    const addAmenity = () => {
                      const newA = [...parsedAmenities, { title: 'New Amenity', desc: 'Description here...' }];
                      setFrontendContent({...frontendContent, cms_amenities_list: JSON.stringify(newA)});
                    };

                    const updateAmenity = (idx, field, value) => {
                      const newA = [...parsedAmenities];
                      newA[idx][field] = value;
                      setFrontendContent({...frontendContent, cms_amenities_list: JSON.stringify(newA)});
                    };

                    const removeAmenity = (idx) => {
                      const newA = parsedAmenities.filter((_, i) => i !== idx);
                      setFrontendContent({...frontendContent, cms_amenities_list: JSON.stringify(newA)});
                    };

                    return (
                      <div className="space-y-4">
                        {parsedAmenities.map((am, idx) => (
                          <div key={idx} className="flex gap-4 items-start bg-dark-800 p-4 border border-dark-700 rounded relative">
                            <div className="flex-1 space-y-2">
                              <input type="text" value={am.title} onChange={e => updateAmenity(idx, 'title', e.target.value)} className="w-full bg-dark-900 text-white border border-dark-600 rounded p-2 focus:border-brand-500 outline-none text-sm font-bold" placeholder="Title (e.g. High-Speed WiFi)" />
                              <textarea rows="2" value={am.desc} onChange={e => updateAmenity(idx, 'desc', e.target.value)} className="w-full bg-dark-900 text-gray-300 border border-dark-600 rounded p-2 focus:border-brand-500 outline-none text-sm" placeholder="Description..."></textarea>
                            </div>
                            <button type="button" onClick={() => removeAmenity(idx)} className="text-red-500 hover:text-red-400 p-2"><X size={18}/></button>
                          </div>
                        ))}
                        <button type="button" onClick={addAmenity} className="btn-secondary py-2 px-4 text-sm w-full border border-dashed border-dark-600 hover:border-gold-500"><Plus size={16} className="inline mr-2"/> Add Facility</button>
                      </div>
                    );
                  })()}
                </div>
              </div>

              <button type="submit" className="btn-primary py-3 px-8 text-lg font-bold">Save Website Content</button>
            </form>
          </div>
        )}

      </div>

      {/* --- PAGE BUILDER MODAL (ELEMENTOR STYLE) --- */}
      {isPageModalOpen && (
        <div className="fixed inset-0 bg-dark-900 flex flex-col z-50 animate-in slide-in-from-bottom">
          {/* Builder Topbar */}
          <div className="h-16 bg-dark-800 border-b border-dark-700 flex justify-between items-center px-6 shrink-0 shadow-lg relative z-10">
            <div className="flex items-center gap-4">
              <button onClick={() => setIsPageModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-dark-700 hover:bg-dark-600 transition-colors"><X size={16}/></button>
              <h2 className="text-lg font-bold text-white">{isEdit ? 'Edit Page' : 'Create New Page'}</h2>
            </div>
            
            <div className="flex bg-dark-900 rounded-lg p-1 border border-dark-700">
              <button onClick={() => setActiveSectionTab('content')} className={`px-6 py-1.5 rounded text-sm font-bold transition-colors ${activeSectionTab === 'content' ? 'bg-dark-700 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}>Content Blocks</button>
              <button onClick={() => setActiveSectionTab('seo')} className={`px-6 py-1.5 rounded text-sm font-bold transition-colors ${activeSectionTab === 'seo' ? 'bg-dark-700 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}>SEO Settings</button>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-sm font-bold text-gray-400">Published</span>
                <input type="checkbox" checked={pageForm.is_published} onChange={e => setPageForm({...pageForm, is_published: e.target.checked})} className="w-5 h-5 accent-brand-500 rounded"/>
              </label>
              <button onClick={handleSavePage} className="btn-primary py-2 px-8 font-bold rounded shadow-[0_0_15px_rgba(223,104,83,0.3)]">Save Page</button>
            </div>
          </div>

          {/* Builder Workspace */}
          <div className="flex-1 flex overflow-hidden">
            
            {/* Left Sidebar: Settings */}
            <div className="w-80 bg-dark-800 border-r border-dark-700 flex flex-col overflow-y-auto">
              {activeSectionTab === 'content' && (
                <div className="p-6 space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Page Details</label>
                    <input type="text" required value={pageForm.title} onChange={e => setPageForm({...pageForm, title: e.target.value})} className="w-full bg-dark-900 border border-dark-700 p-3 rounded text-white outline-none focus:border-brand-500 text-sm mb-3" placeholder="Page Title" />
                    <input type="text" required value={pageForm.slug} onChange={e => setPageForm({...pageForm, slug: e.target.value})} className="w-full bg-dark-900 border border-dark-700 p-3 rounded text-white outline-none focus:border-brand-500 text-sm font-mono" placeholder="URL Slug (e.g. about-us)" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Page Type</label>
                    <select value={pageForm.page_type} onChange={e => setPageForm({...pageForm, page_type: e.target.value})} className="w-full bg-dark-900 border border-dark-700 p-3 rounded text-white outline-none focus:border-brand-500 text-sm">
                      <option value="landing_page">Standard Landing Page</option>
                      <option value="property_page">Property Description Page</option>
                      <option value="room_page">Room Listing Page</option>
                    </select>
                  </div>
                  
                  <div className="pt-6 border-t border-dark-700">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Add Content Blocks</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => addBlock('hero')} className="p-3 bg-dark-900 border border-dark-700 rounded hover:border-brand-500 text-gray-400 hover:text-white transition-colors flex flex-col items-center gap-2 text-xs font-bold">
                        <LayoutTemplate size={20}/> Hero Section
                      </button>
                      <button onClick={() => addBlock('text')} className="p-3 bg-dark-900 border border-dark-700 rounded hover:border-brand-500 text-gray-400 hover:text-white transition-colors flex flex-col items-center gap-2 text-xs font-bold">
                        <FileText size={20}/> Rich Text
                      </button>
                      <button onClick={() => addBlock('rooms')} className="p-3 bg-dark-900 border border-dark-700 rounded hover:border-brand-500 text-gray-400 hover:text-white transition-colors flex flex-col items-center gap-2 text-xs font-bold">
                        <CheckCircle size={20}/> Featured Rooms
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeSectionTab === 'seo' && (
                <div className="p-6 space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">SEO Meta Title</label>
                    <input type="text" value={pageForm.meta_title} onChange={e => setPageForm({...pageForm, meta_title: e.target.value})} className="w-full bg-dark-900 border border-dark-700 p-3 rounded text-white outline-none focus:border-brand-500 text-sm" placeholder="Max 60 chars" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">SEO Description</label>
                    <textarea rows={4} value={pageForm.meta_description} onChange={e => setPageForm({...pageForm, meta_description: e.target.value})} className="w-full bg-dark-900 border border-dark-700 p-3 rounded text-white outline-none focus:border-brand-500 text-sm" placeholder="Max 160 chars..."></textarea>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Keywords</label>
                    <input type="text" value={pageForm.seo_keywords} onChange={e => setPageForm({...pageForm, seo_keywords: e.target.value})} className="w-full bg-dark-900 border border-dark-700 p-3 rounded text-white outline-none focus:border-brand-500 text-sm" placeholder="luxury, hotel, booking" />
                  </div>
                  
                  {/* Google Preview */}
                  <div className="mt-8 pt-6 border-t border-dark-700">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Google Search Preview</label>
                    <div className="bg-white p-4 rounded text-left">
                      <div className="text-sm text-[#1a0dab] truncate whitespace-nowrap">{pageForm.title || 'Page Title'} - Luxe PMS</div>
                      <div className="text-xs text-[#006621] truncate whitespace-nowrap">https://yourdomain.com/{pageForm.slug || 'slug'}</div>
                      <div className="text-xs text-[#545454] mt-1 line-clamp-2 leading-tight">
                        {pageForm.meta_description || 'Please provide a compelling meta description to increase click-through rates.'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Main Area: Block Editor Canvas */}
            <div className="flex-1 bg-black p-8 overflow-y-auto">
              <div className="max-w-4xl mx-auto space-y-6">
                
                {pageForm.blocks.length === 0 ? (
                  <div className="py-32 text-center border-2 border-dashed border-dark-700 rounded-xl">
                    <LayoutTemplate size={48} className="mx-auto text-dark-600 mb-4"/>
                    <h3 className="text-xl font-bold text-white mb-2">Canvas is Empty</h3>
                    <p className="text-gray-500">Select a content block from the left menu to start building.</p>
                  </div>
                ) : (
                  pageForm.blocks.map((block, index) => (
                    <div key={block.id} className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden group relative transition-all hover:border-brand-500 shadow-lg">
                      
                      {/* Block Controls Toolbar */}
                      <div className="absolute top-4 right-4 flex bg-dark-900 border border-dark-700 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <button onClick={() => moveBlock(index, 'up')} className="p-2 hover:bg-dark-700 text-gray-400 hover:text-white border-r border-dark-700" title="Move Up"><MoveUp size={14}/></button>
                        <button onClick={() => moveBlock(index, 'down')} className="p-2 hover:bg-dark-700 text-gray-400 hover:text-white border-r border-dark-700" title="Move Down"><MoveDown size={14}/></button>
                        <button onClick={() => removeBlock(block.id)} className="p-2 hover:bg-red-500 hover:text-white text-gray-400" title="Delete Block"><Trash2 size={14}/></button>
                      </div>

                      {/* Block Header */}
                      <div className="bg-dark-900 border-b border-dark-700 p-3 px-6 flex items-center gap-3">
                        <div className="w-6 h-6 rounded bg-brand-500/20 text-brand-500 flex items-center justify-center font-bold text-xs">{index + 1}</div>
                        <h4 className="font-bold text-white uppercase tracking-wider text-sm">{block.type} BLOCK</h4>
                      </div>

                      {/* Block Form Editors */}
                      <div className="p-6">
                        {block.type === 'hero' && (
                          <div className="space-y-4">
                            <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Headline</label>
                              <input type="text" value={block.data.headline} onChange={e => updateBlock(block.id, { headline: e.target.value })} className="w-full bg-dark-900 border border-dark-700 p-3 rounded text-white text-xl font-bold outline-none focus:border-brand-500" />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Subheadline</label>
                              <input type="text" value={block.data.subheadline} onChange={e => updateBlock(block.id, { subheadline: e.target.value })} className="w-full bg-dark-900 border border-dark-700 p-3 rounded text-gray-300 outline-none focus:border-brand-500" />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Background Image URL (from Gallery)</label>
                              <input type="text" value={block.data.bg_image} onChange={e => updateBlock(block.id, { bg_image: e.target.value })} className="w-full bg-dark-900 border border-dark-700 p-3 rounded text-blue-400 font-mono text-sm outline-none focus:border-brand-500" placeholder="https://..." />
                            </div>
                          </div>
                        )}

                        {block.type === 'text' && (
                          <div>
                            <textarea rows={6} value={block.data.text} onChange={e => updateBlock(block.id, { text: e.target.value })} className="w-full bg-dark-900 border border-dark-700 p-4 rounded text-gray-300 outline-none focus:border-brand-500 font-serif leading-relaxed" placeholder="Write HTML or plain text here..."></textarea>
                          </div>
                        )}

                        {block.type === 'rooms' && (
                          <div className="flex gap-4">
                            <div className="flex-1">
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Section Title</label>
                              <input type="text" value={block.data.title} onChange={e => updateBlock(block.id, { title: e.target.value })} className="w-full bg-dark-900 border border-dark-700 p-3 rounded text-white outline-none focus:border-brand-500" />
                            </div>
                            <div className="w-32">
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Limit</label>
                              <input type="number" value={block.data.limit} onChange={e => updateBlock(block.id, { limit: parseInt(e.target.value) })} className="w-full bg-dark-900 border border-dark-700 p-3 rounded text-white outline-none focus:border-brand-500 text-center" min={1} max={10} />
                            </div>
                          </div>
                        )}
                      </div>

                    </div>
                  ))
                )}
                
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default AdminCMS;
