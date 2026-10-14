import React, { useState } from 'react';
import { Search, Download, CheckCircle, AlertCircle, Loader, Barcode, Database } from 'lucide-react';
import api from '../services/api';

const ProductImport = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState('name'); // 'name' or 'barcode'
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [error, setError] = useState('');
  const [importStatus, setImportStatus] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setLoading(true);
    setError('');
    setResults([]);
    setImportStatus(null);

    try {
      const endpoint = searchType === 'barcode' 
        ? `/products/external/barcode/${searchTerm}`
        : `/products/external/search?q=${searchTerm}`;
      
      const res = await api.get(endpoint);
      if (res.data.success) {
        setResults(searchType === 'barcode' ? [res.data.data] : res.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch products from external API');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (product) => {
    try {
      const res = await api.post('/products/import', product);
      if (res.data.success) {
        setImportStatus({ id: product.barcode, status: 'success', message: 'Imported successfully' });
      }
    } catch (err) {
      setImportStatus({ 
        id: product.barcode, 
        status: 'error', 
        message: err.response?.data?.message || 'Failed to import' 
      });
    }
  };

  const handleBulkImport = async () => {
    if (!searchTerm.trim()) return;
    setBulkLoading(true);
    setError('');
    setImportStatus(null);

    try {
      const res = await api.post('/products/import/bulk', { search_term: searchTerm, max_products: 50 });
      if (res.data.success) {
        setImportStatus({
          bulk: true,
          status: 'success',
          message: `Bulk Import Complete. Found: ${res.data.data.found}, Imported: ${res.data.data.imported}, Existed: ${res.data.data.already_existed}, Skipped: ${res.data.data.skipped}`
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Bulk import failed');
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Database size={28} className="text-blue-600" />
            Import Real Products
          </h1>
          <p className="text-gray-500 mt-1">Search and import master product data from Open Food Facts</p>
        </div>
      </div>

      {importStatus?.bulk && (
        <div className={`p-4 rounded-lg flex items-start gap-3 ${importStatus.status === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {importStatus.status === 'success' ? <CheckCircle className="mt-0.5" /> : <AlertCircle className="mt-0.5" />}
          <div>
            <h3 className="font-semibold">{importStatus.status === 'success' ? 'Import Successful' : 'Import Failed'}</h3>
            <p className="text-sm mt-1">{importStatus.message}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-2">
          <AlertCircle size={20} /> {error}
        </div>
      )}

      <div className="card p-6">
        <form onSubmit={handleSearch} className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Search External Database</label>
            <div className="flex gap-2">
              <select 
                className="input-field w-40"
                value={searchType}
                onChange={(e) => setSearchType(e.target.value)}
              >
                <option value="name">By Name</option>
                <option value="barcode">By Barcode</option>
              </select>
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder={searchType === 'barcode' ? 'e.g., 3017624010701' : 'e.g., Maggi, Coca Cola, Amul'}
                  className="input-field w-full pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  required
                />
                {searchType === 'barcode' ? (
                  <Barcode className="absolute left-3 top-2.5 text-gray-400" size={20} />
                ) : (
                  <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
                )}
              </div>
            </div>
          </div>
          <button type="submit" disabled={loading} className="btn btn-primary min-w-[120px] flex justify-center">
            {loading ? <Loader className="animate-spin" size={20} /> : 'Search'}
          </button>
          {searchType === 'name' && (
            <button 
              type="button" 
              onClick={handleBulkImport} 
              disabled={bulkLoading || !searchTerm} 
              className="btn btn-secondary min-w-[140px] flex justify-center gap-2"
            >
              {bulkLoading ? <Loader className="animate-spin" size={20} /> : <><Download size={18}/> Bulk Import</>}
            </button>
          )}
        </form>
      </div>

      {results.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Product Details</th>
                  <th>Brand</th>
                  <th>Category</th>
                  <th>Package Size</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {results.map((product, idx) => (
                  <tr key={idx}>
                    <td className="w-20">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.product_name} className="w-12 h-12 object-contain rounded bg-white" />
                      ) : (
                        <div className="w-12 h-12 bg-gray-100 flex items-center justify-center rounded text-gray-400">
                          <Database size={20} />
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="font-semibold text-gray-800">{product.product_name}</div>
                      <div className="text-xs text-gray-500 font-mono flex items-center gap-1 mt-1">
                        <Barcode size={12} /> {product.barcode || 'N/A'}
                      </div>
                    </td>
                    <td className="text-gray-600">{product.brand}</td>
                    <td>
                      <span className="badge badge-blue">{product.category}</span>
                    </td>
                    <td className="text-gray-600">{product.unit}</td>
                    <td className="text-right">
                      {importStatus?.id === product.barcode && importStatus?.status === 'success' ? (
                        <span className="text-green-600 font-medium flex items-center justify-end gap-1">
                          <CheckCircle size={16} /> Imported
                        </span>
                      ) : (
                        <div className="flex flex-col items-end gap-1">
                          <button 
                            onClick={() => handleImport(product)}
                            className="btn btn-primary text-sm py-1.5 px-3 flex items-center gap-1"
                          >
                            <Download size={16} /> Import
                          </button>
                          {importStatus?.id === product.barcode && importStatus?.status === 'error' && (
                            <span className="text-red-500 text-xs">{importStatus.message}</span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductImport;
