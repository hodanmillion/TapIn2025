import axios, { AxiosInstance } from 'axios';
import { Capacitor } from '@capacitor/core';
import { CapacitorHttp } from '@capacitor/core';
import toast from 'react-hot-toast';

// Create API instance based on platform
const createApi = () => {
  const baseURL = import.meta.env.VITE_API_BASE_URL || '/';
  
  // For native platforms, create a wrapper that uses CapacitorHttp
  if (Capacitor.isNativePlatform()) {
    console.log('Using CapacitorHttp for native platform');
    
    // Create axios-like interface using CapacitorHttp
    const mobileApi = {
      async request(config: any) {
        const url = config.url.startsWith('http') ? config.url : `${baseURL}${config.url}`;
        const method = config.method?.toUpperCase() || 'GET';
        
        console.log(`CapacitorHttp ${method}:`, url);
        
        // Ensure config.headers exists
        if (!config.headers) {
          config.headers = {};
        }
        
        const headers = {
          'Content-Type': 'application/json',
          ...config.headers,
          ...(localStorage.getItem('token') && {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          })
        };
        
        try {
          let response;
          
          switch (method) {
            case 'GET':
              response = await CapacitorHttp.get({
                url,
                headers,
                params: config.params
              });
              break;
            case 'POST':
              response = await CapacitorHttp.post({
                url,
                headers,
                data: config.data || {},
                params: config.params
              });
              break;
            case 'PUT':
              response = await CapacitorHttp.put({
                url,
                headers,
                data: config.data || {}
              });
              break;
            case 'DELETE':
              response = await CapacitorHttp.delete({
                url,
                headers
              });
              break;
            default:
              throw new Error(`Unsupported method: ${method}`);
          }
          
          return response;
        } catch (error: any) {
          console.error('CapacitorHttp error:', error);
          
          // Handle errors similar to axios
          if (error.status === 401) {
            localStorage.removeItem('token');
            window.location.href = '/login';
          } else if (error.data?.message) {
            toast.error(error.data.message);
          } else if (error.data?.error) {
            toast.error(error.data.error);
          } else if (error.message === 'Network Error') {
            toast.error('Cannot connect to server. Please check your network.');
          } else {
            toast.error('An unexpected error occurred');
          }
          
          throw error;
        }
      },
      
      get(url: string, config?: any) {
        return this.request({ ...config, method: 'GET', url });
      },
      
      post(url: string, data?: any, config?: any) {
        return this.request({ ...config, method: 'POST', url, data });
      },
      
      put(url: string, data?: any, config?: any) {
        return this.request({ ...config, method: 'PUT', url, data });
      },
      
      delete(url: string, config?: any) {
        return this.request({ ...config, method: 'DELETE', url });
      },
      
      defaults: {
        baseURL,
        headers: {
          common: {}
        }
      }
    };
    
    return mobileApi as any as AxiosInstance;
  }
  
  // For web, use regular axios
  const api = axios.create({
    baseURL,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  api.interceptors.response.use(
    (response) => response,
    (error) => {
      // Enhanced error logging for debugging
      console.error('API Error:', {
        url: error.config?.url,
        method: error.config?.method,
        baseURL: error.config?.baseURL,
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      
      if (error.response?.status === 401) {
        localStorage.removeItem('token')
        window.location.href = '/login'
      } else if (error.response?.data?.message) {
        toast.error(error.response.data.message);
      } else if (error.response?.data?.error) {
        toast.error(error.response.data.error);
      } else if (error.message === 'Network Error') {
        toast.error('Cannot connect to server. Please check your network.');
      } else {
        toast.error('An unexpected error occurred');
      }
      return Promise.reject(error);
    }
  );
  
  return api;
};

const api = createApi();

export default api;