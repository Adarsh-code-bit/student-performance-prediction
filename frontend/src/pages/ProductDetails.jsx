import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Package, ArrowLeft, Loader, Database, Calendar, MapPin, Archive } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

const ProductDetails = () => {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [imgError, setImgError] = useState(false);
  const { addToast } = useToast();

  const fetchProduct = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/products/${id}`);
      if (res.data.success) {
        setProduct(res.data.data);
      }
    } catch (err) {
      addToast('Failed to fetch product details', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProduct();
  }, [id]);

  const handleGenerateInventory = async () => {
    setGenerating(true);
    try {
      const res = await api.post(`/products/${id}/generate-inventory`);
      if (res.data.success) {
        addToast('Demo inventory generated successfully!', 'success');
        // Re-fetch to see updated counts if we had them, though right now we don't fetch batches in getOne.
      }
    } catch (err) {
      addToast('Failed to generate inventory', 'error');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return <div className="p-8 flex justify-center"><Loader className="animate-spin text-blue-500" size={32}/></div>;
  }

  if (!product) {
    return <div className="p-8 text-center text-gray-500">Product not found</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      <div className="flex items-center gap-4">
        <Link to="/products" className="btn-icon bg-white shadow-sm border border-gray-200 w-10 h-10 rounded-full flex justify-center items-center">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{product.product_name}</h1>
          <p className="text-gray-500 text-sm">Product ID: {product.product_id} • SKU: {product.sku}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Real Product Master Data */}
        <div className="lg:col-span-2">
          <div className="card p-0 overflow-hidden h-full">
            <div className="border-b px-6 py-4 bg-gray-50 flex justify-between items-center">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Database size={18} className="text-blue-600"/> Real External Product Data
              </h3>
              {product.external_source && <span className="badge badge-blue">{product.external_source}</span>}
            </div>
            <div className="p-6 flex flex-col md:flex-row gap-8">
              <div className="w-48 h-48 bg-gray-50 border rounded-lg flex-shrink-0 flex items-center justify-center p-2">
                {product.image_url && !imgError ? (
                  <img 
                    src={product.image_url} 
                    alt={product.product_name} 
                    className="w-full h-full object-contain"
                    onError={() => setImgError(true)} 
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-1.5 text-center text-gray-400">
                    <Package size={44} className="text-gray-300" />
                    <span className="text-xs font-medium text-gray-500">Image unavailable</span>
                  </div>
                )}
              </div>
              <div className="flex-1 grid grid-cols-2 gap-y-6 gap-x-4">
                <div>
                  <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Product Name</div>
                  <div className="text-lg font-medium text-gray-900 mt-1">{product.product_name}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Brand</div>
                  <div className="text-lg text-gray-800 mt-1">{product.brand || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Category</div>
                  <div className="text-gray-800 mt-1">{product.category_name}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Barcode</div>
                  <div className="text-gray-800 mt-1 font-mono">{product.barcode || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Package Size</div>
                  <div className="text-gray-800 mt-1">{product.unit}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Status</div>
                  <div className="mt-1">
                    {product.is_active ? <span className="badge badge-green">Active</span> : <span className="badge badge-red">Inactive</span>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Demo Operational Data */}
        <div className="lg:col-span-1">
          <div className="card p-0 overflow-hidden h-full flex flex-col">
            <div className="border-b px-6 py-4 bg-orange-50 flex justify-between items-center">
              <h3 className="font-semibold text-orange-800 flex items-center gap-2">
                <Archive size={18} /> Demo Operational Data
              </h3>
            </div>
            <div className="p-6 flex-1 flex flex-col">
              <p className="text-sm text-gray-600 mb-6 bg-orange-50/50 p-3 rounded border border-orange-100">
                This represents internal Q-Commerce warehouse data (inventory, locations, batches). It is <strong>not</strong> provided by the external product database.
              </p>
              
              <div className="space-y-4 flex-1">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                    <Archive size={20} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-800">Inventory Management</div>
                    <div className="text-xs text-gray-500">Stock tracking and allocation</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                    <Calendar size={20} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-800">Batch & Expiry</div>
                    <div className="text-xs text-gray-500">FEFO tracking via realistic batches</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                    <MapPin size={20} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-800">Warehouse Locations</div>
                    <div className="text-xs text-gray-500">Physical zones and racks</div>
                  </div>
                </div>
              </div>

              <button 
                onClick={handleGenerateInventory}
                disabled={generating}
                className="btn w-full justify-center mt-6 bg-orange-600 hover:bg-orange-700 text-white"
              >
                {generating ? <Loader className="animate-spin" size={18}/> : 'Generate Demo Inventory'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetails;
