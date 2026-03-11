import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { api } from '../api/client';
import bgImage from '../assets/Login assets/3e0829318639dbd8068304207842e436285af947.jpg';
import logo from '../assets/Logo-oleyes-holding-2.png';

const STEPS = [
    { id: 1, title: 'Business Type' },
    { id: 2, title: 'Business Details' },
    { id: 3, title: 'Security Priorities' },
    { id: 4, title: 'Camera Setup' },
];

export const Onboarding = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Form State
    const [businessType, setBusinessType] = useState('');
    const [businessName, setBusinessName] = useState('');
    const [shortDescription, setShortDescription] = useState('');
    const [locations, setLocations] = useState('');
    const [cameras, setCameras] = useState('');
    const [businessSize, setBusinessSize] = useState('');
    const [priorities, setPriorities] = useState({
        theft: false,
        suspicious: false,
        loitering: false,
        employee: false,
        customer: false,
    });
    const [cameraType, setCameraType] = useState('');

    const handleNext = () => {
        if (step < 4) setStep(step + 1);
    };

    const handleBack = () => {
        if (step > 1) setStep(step - 1);
    }

    useEffect(() => {
        const loadContext = async () => {
            try {
                const token = localStorage.getItem('access_token');
                if (!token) return;

                const data = await api.getContext();
                if (data) {
                    if (data.business_type) setBusinessType(data.business_type);
                    if (data.business_name) setBusinessName(data.business_name);
                    if (data.short_description) setShortDescription(data.short_description);
                    if (data.number_of_locations) setLocations(data.number_of_locations);
                    if (data.estimated_cameras) setCameras(data.estimated_cameras);
                    if (data.business_size) setBusinessSize(data.business_size);
                    if (data.camera_type) setCameraType(data.camera_type);

                    if (data.security_priorities) {
                        setPriorities({
                            theft: data.security_priorities.theft_detection ?? false,
                            suspicious: data.security_priorities.suspicious_behavior_detection ?? false,
                            loitering: data.security_priorities.loitering_detection ?? false,
                            employee: data.security_priorities.employee_monitoring ?? false,
                            customer: data.security_priorities.customer_behavior_analytics ?? false,
                        });
                    }
                }
            } catch (err) {
                console.log('No existing context found or error fetching context', err);
            }
        };
        loadContext();
    }, []);

    const handleSubmit = async () => {
        setLoading(true);
        setError('');

        try {
            const token = localStorage.getItem('access_token');
            if (!token) {
                navigate('/login');
                return;
            }

            const payload = {
                business_type: businessType || 'General Store',
                business_name: businessName,
                short_description: shortDescription,
                number_of_locations: locations,
                estimated_cameras: cameras,
                business_size: businessSize,
                camera_type: cameraType,
                security_priorities: {
                    theft_detection: priorities.theft ?? false,
                    suspicious_behavior_detection: priorities.suspicious ?? false,
                    loitering_detection: priorities.loitering ?? false,
                    employee_monitoring: priorities.employee ?? false,
                    customer_behavior_analytics: priorities.customer ?? false,
                }
            };

            try {
                await api.createContext(payload);
            } catch (err: any) {
                if (err.response?.status === 409) {
                    await api.updateContext(payload);
                } else {
                    throw err;
                }
            }

            navigate('/');
        } catch (err: any) {
            setError(err.response?.data?.detail || err.message || 'An error occurred while saving setup data.');
        } finally {
            setLoading(false);
        }
    };

    const togglePriority = (key: keyof typeof priorities) => {
        setPriorities(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // Render Form Field Helpers
    const renderInput = (label: string, value: string, setter: (v: string) => void, placeholder: string = '', type = 'text') => (
        <div className="mb-4">
            <label className="block text-sm font-medium text-white mb-2">{label}</label>
            <input
                type={type}
                value={value}
                onChange={(e) => setter(e.target.value)}
                className="w-full bg-[#1e2548]/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-[#6c779e] focus:outline-none focus:border-[#5978ff] focus:ring-1 focus:ring-[#5978ff] transition-all backdrop-blur-md"
                placeholder={placeholder}
            />
        </div>
    );

    const renderSelect = (label: string, value: string, setter: (v: string) => void, options: string[], placeholder: string) => (
        <div className="mb-4">
            <label className="block text-sm font-medium text-white mb-2">{label}</label>
            <select
                value={value}
                onChange={(e) => setter(e.target.value)}
                className="w-full bg-[#1e2548]/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-[#6c779e] focus:outline-none focus:border-[#5978ff] focus:ring-1 focus:ring-[#5978ff] transition-all backdrop-blur-md appearance-none"
            >
                <option value="" disabled className="bg-[#1e2548] text-neutral-400">{placeholder}</option>
                {options.map(opt => (
                    <option key={opt} value={opt} className="bg-[#1e2548] text-white">{opt}</option>
                ))}
            </select>
        </div>
    );

    const renderToggle = (label: string, key: keyof typeof priorities) => (
        <div className="flex items-center justify-between py-3 mb-2">
            <span className="text-white text-md font-medium">{label}</span>
            <button
                type="button"
                onClick={() => togglePriority(key)}
                className={`w-12 h-6 rounded-full transition-colors relative ${priorities[key] ? 'bg-white' : 'bg-white/20'}`}
            >
                <div className={`w-5 h-5 rounded-full shadow-md transform transition-transform absolute top-0.5 ${priorities[key] ? 'translate-x-6 bg-[#6b8cff]' : 'translate-x-1 bg-white'}`} />
            </button>
        </div>
    );

    return (
        <div
            className="min-h-screen bg-cover bg-center flex flex-col p-4 relative"
            style={{ backgroundImage: `url('${bgImage}')` }}
        >
            <div className="absolute inset-0 bg-black/40 mix-blend-multiply"></div>

            {/* Stepper Header */}
            <div className="relative z-20 w-full max-w-3xl mx-auto pt-10 pb-12">
                <div className="flex justify-between items-start relative">
                    {/* Progressive track line */}
                    <div className="absolute top-7 left-12 right-12 -z-10 h-[3px] bg-white/20 rounded-full">
                        <div
                            className="absolute inset-y-0 left-0 bg-white rounded-full transition-all duration-500 ease-in-out"
                            style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }}
                        ></div>
                    </div>

                    {STEPS.map((s) => (
                        <div key={s.id} className="flex flex-col items-center relative z-10 w-24">
                            <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 mb-3 ${step >= s.id
                                ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)]'
                                : 'bg-transparent border-[3px] border-white/20'
                                }`}>
                                <Check size={26} strokeWidth={2.5} className={`transition-opacity duration-300 ${step >= s.id ? 'opacity-100' : 'opacity-0'}`} />
                            </div>
                            <span className={`text-[13px] font-medium tracking-wide text-center leading-tight transition-colors duration-300 ${step >= s.id ? 'text-white' : 'text-white/40'}`}>
                                {s.title.split(' ').map((word, i) => <div key={i}>{word}</div>)}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 w-full max-w-6xl mx-auto grid md:grid-cols-[1fr_450px] gap-12 items-center relative z-10 px-4 md:px-0">

                {/* Left Side: Branding */}
                <div className="hidden md:flex flex-col justify-between h-[500px] text-white">
                    <div className="flex items-center">
                        <img src={logo} alt="Oleyes Logo" className="h-16" />
                    </div>

                    <div className="mb-10">
                        <h1 className="text-5xl lg:text-5xl font-light mb-2">Smart AI</h1>
                        <h1 className="text-5xl lg:text-5xl font-light italic text-white/90 mb-5">Surveillance.</h1>
                        <p className="text-xl lg:text-xl font-light text-neutral-300 italic">Protecting What Matters Most</p>
                    </div>
                </div>

                {/* Right Side: Dynamic Form Area */}
                <div className="w-full">
                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
                            {error}
                        </div>
                    )}

                    {step === 1 && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            {renderSelect('Business Type', businessType, setBusinessType, ['Retail Store', 'Supermarket', 'Warehouse', 'Office', 'Mall', 'Other'], 'Select your business type')}
                        </div>
                    )}

                    {step === 2 && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-1">
                            {renderInput('Business Name', businessName, setBusinessName, 'Enter Your Business Name')}
                            {renderInput('Short Description', shortDescription, setShortDescription, 'Enter Your Short Description')}
                            {renderInput('Number of Locations', locations, setLocations, 'Enter Your Number of Locations', 'number')}
                            {renderInput('Estimated Number of Cameras', cameras, setCameras, 'Enter Your Number of Cameras', 'number')}
                            {renderSelect('Business Size', businessSize, setBusinessSize, ['Small', 'Medium', 'Large'], 'Enter Your Business Size')}
                        </div>
                    )}

                    {step === 3 && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300 max-w-sm ml-auto">
                            {renderToggle('Theft Detection', 'theft')}
                            {renderToggle('Suspicious Behavior Detection', 'suspicious')}
                            {renderToggle('Loitering Detection', 'loitering')}
                            {renderToggle('Employee Monitoring', 'employee')}
                            {renderToggle('Customer Behavior Analytics', 'customer')}
                        </div>
                    )}

                    {step === 4 && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            {renderSelect('Camera Type Selection', cameraType, setCameraType, ['IP Camera', 'Analog + DVR', 'RTSP Stream', 'Webcam'], 'Select Camera Type')}
                        </div>
                    )}

                    <div className="mt-10 flex justify-end gap-4">
                        {step > 1 && (
                            <button
                                type="button"
                                onClick={handleBack}
                                className="bg-white/5 border border-white/10 text-white font-medium py-3 px-8 rounded-xl hover:bg-white/10 transition-colors"
                            >
                                Back
                            </button>
                        )}
                        {step < 4 ? (
                            <button
                                type="button"
                                onClick={handleNext}
                                className="bg-gradient-to-r from-[#6b8cff] to-[#4061ff] text-white font-medium py-3 px-12 rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-blue-500/25 ml-auto block"
                            >
                                Next
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={loading}
                                className="bg-gradient-to-r from-[#6b8cff] to-[#4061ff] text-white font-medium py-3 px-12 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/25 ml-auto block"
                            >
                                {loading ? 'Saving...' : 'Finish setup'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
