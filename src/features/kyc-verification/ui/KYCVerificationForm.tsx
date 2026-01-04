import { useState, useEffect } from 'react';
import { useLanguage } from '@src/app/providers/useLanguage';
import { userApi, paymentMethodsApi } from '@src/shared/api';
import { CountrySelect } from '@src/shared/ui/CountrySelect';
import { detectUserCountry } from '@src/shared/lib/geolocation.util';
import './KYCVerificationForm.css';

interface KYCVerificationFormProps {
    user: any;
    onSuccess?: () => void;
}

interface Country {
    code: string;
    name: string;
}

export function KYCVerificationForm({ user, onSuccess }: KYCVerificationFormProps) {
    const { t } = useLanguage();
    const [currentStep, setCurrentStep] = useState(1);
    const totalSteps = 3; // Уменьшили количество шагов
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
    const [success, setSuccess] = useState(false);
    const [forceShowForm, setForceShowForm] = useState(false);
    
    // Получаем имя и фамилию из профиля пользователя
    const getUserFirstName = () => {
        return (user as any)?.firstname || (user as any)?.first_name || (user as any)?.firstName || '';
    };
    
    const getUserLastName = () => {
        return (user as any)?.lastname || (user as any)?.last_name || (user as any)?.lastName || '';
    };
    
    // Парсим полное имя, если есть только оно
    const parseFullName = (fullName: string) => {
        if (!fullName) return { first: '', last: '' };
        const parts = fullName.trim().split(/\s+/);
        if (parts.length === 1) return { first: parts[0], last: '' };
        const last = parts.pop() || '';
        const first = parts.join(' ');
        return { first, last };
    };
    
    const existingFullName = user?.kyc_full_name || '';
    const parsedName = parseFullName(existingFullName);
    const userFirstName = getUserFirstName() || parsedName.first;
    const userLastName = getUserLastName() || parsedName.last;
    
    // Форматируем дату рождения для input type="date" (YYYY-MM-DD)
    const formatBirthDate = (date: string | Date | null | undefined): string => {
        if (!date) return '';
        try {
            const dateObj = typeof date === 'string' ? new Date(date) : date;
            if (isNaN(dateObj.getTime())) return '';
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        } catch {
            return '';
        }
    };
    
    const [formData, setFormData] = useState({
        first_name: userFirstName,
        last_name: userLastName,
        birth_date: formatBirthDate(user?.kyc_birth_date),
        street_address: user?.kyc_street_address || '',
        city: user?.kyc_city || '',
        postal_code: user?.kyc_postal_code || '',
        country: '', // Будет установлена в useEffect после загрузки стран
        id_document_type: (user?.kyc_id_document_type || 'passport') as 'passport' | 'drivers_license' | 'national_id' | 'residence_permit',
        id_document_number: user?.kyc_id_document_number || '',
    });

    const [photos, setPhotos] = useState<File[]>([]);
    const [photoPreview, setPhotoPreview] = useState<string[]>([]);
    const [countries, setCountries] = useState<Country[]>([]);
    const [loadingCountries, setLoadingCountries] = useState(true);
    const [userCountryCode, setUserCountryCode] = useState<string | null>(null);

    // Load countries list from API
    useEffect(() => {
        const loadCountries = async () => {
            try {
                setLoadingCountries(true);
                const countriesList = await paymentMethodsApi.getAllCountries();
                
                if (countriesList && countriesList.length > 0) {
                    setCountries(countriesList);
                } else {
                    console.warn("No countries returned from API");
                }
            } catch (err) {
                console.error("Error loading countries:", err);
            } finally {
                setLoadingCountries(false);
            }
        };
        
        loadCountries();
    }, []);

    // Обработка сохраненной страны пользователя и автоопределение
    useEffect(() => {
        const setupCountry = async () => {
            if (countries.length === 0 || loadingCountries) return;
            
            // Если страна уже установлена, пытаемся найти её код в списке стран
            if (user?.kyc_country && !formData.country) {
                const savedCountry = user.kyc_country;
                // Если сохранена как название, ищем по названию
                const countryByName = countries.find(c => 
                    c.name.toLowerCase() === savedCountry.toLowerCase()
                );
                if (countryByName) {
                    setFormData(prev => ({ ...prev, country: countryByName.code }));
                    return;
                }
                // Если сохранена как код, проверяем что он существует
                const countryByCode = countries.find(c => 
                    c.code.toLowerCase() === savedCountry.toLowerCase()
                );
                if (countryByCode) {
                    setFormData(prev => ({ ...prev, country: countryByCode.code }));
                    return;
                }
            }
            
            // Если страна не установлена, автоопределяем
            if (!formData.country) {
                try {
                    const profileCountryCode = (user as any)?.country || (user as any)?.country_code || (user as any)?.countryCode;
                    const geoData = profileCountryCode ? { countryCode: profileCountryCode } : await detectUserCountry();
                    const countryCode = geoData?.countryCode || null;
                    
                    if (countryCode) {
                        const userCountryExists = countries.find(c => c.code === countryCode);
                        if (userCountryExists) {
                            setFormData(prev => ({ ...prev, country: countryCode }));
                            setUserCountryCode(countryCode);
                        }
                    }
                } catch (err) {
                    console.warn("Error detecting user country:", err);
                }
            }
        };
        
        setupCountry();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [countries, loadingCountries]);

    const validateStep = (step: number): boolean => {
        const errors: { [key: string]: string } = {};
        
        if (step === 1) {
            const trimmedFirstName = formData.first_name.trim();
            if (!trimmedFirstName || trimmedFirstName.length < 1 || trimmedFirstName.length > 50) {
                errors.first_name = t('kyc.firstNameError', { defaultValue: 'Имя обязательно и должно быть от 1 до 50 символов' });
            }
            
            const trimmedLastName = formData.last_name.trim();
            if (!trimmedLastName || trimmedLastName.length < 1 || trimmedLastName.length > 50) {
                errors.last_name = t('kyc.lastNameError', { defaultValue: 'Фамилия обязательна и должна быть от 1 до 50 символов' });
            }
            
            if (!formData.birth_date) {
                errors.birth_date = t('kyc.birthDateError', { defaultValue: 'Укажите дату рождения' });
            }
            
            const trimmedStreetAddress = formData.street_address.trim();
            if (!trimmedStreetAddress || trimmedStreetAddress.length < 5 || trimmedStreetAddress.length > 200) {
                errors.street_address = t('kyc.streetAddressError', { defaultValue: 'Адрес должен быть от 5 до 200 символов' });
            }
            
            const trimmedCity = formData.city.trim();
            if (!trimmedCity || trimmedCity.length < 1 || trimmedCity.length > 100) {
                errors.city = t('kyc.cityError', { defaultValue: 'Город обязателен и должен быть от 1 до 100 символов' });
            }
            
            const trimmedPostalCode = formData.postal_code.trim();
            if (!trimmedPostalCode || trimmedPostalCode.length < 4 || trimmedPostalCode.length > 20) {
                errors.postal_code = t('kyc.postalCodeError', { defaultValue: 'Почтовый индекс должен быть от 4 до 20 символов' });
            }
            
            if (!formData.country) {
                errors.country = t('kyc.countryError', { defaultValue: 'Выберите страну' });
            }
        } else if (step === 2) {
            if (!formData.id_document_type) {
                errors.id_document_type = t('kyc.documentTypeError', { defaultValue: 'Выберите тип документа' });
            }
            
            const trimmedDocumentNumber = formData.id_document_number.trim();
            if (!trimmedDocumentNumber || trimmedDocumentNumber.length < 5 || trimmedDocumentNumber.length > 50) {
                errors.id_document_number = t('kyc.documentNumberError', { defaultValue: 'Номер документа должен быть от 5 до 50 символов' });
            }
        } else if (step === 3) {
            if (photos.length === 0) {
                errors.photos = t('kyc.photosRequired', { defaultValue: 'Загрузите хотя бы одну фотографию' });
            }
            if (photos.length > 4) {
                errors.photos = t('kyc.photosMaxError', { defaultValue: 'Можно загрузить не более 4 фотографий' });
            }
        }
        
        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const validateForm = (): number | null => {
        // Проверяем каждый шаг и возвращаем номер первого шага с ошибкой
        if (!validateStep(1)) return 1;
        if (!validateStep(2)) return 2;
        if (!validateStep(3)) return 3;
        return null; // Все шаги валидны
    };

    const handleNextStep = () => {
        if (validateStep(currentStep) && currentStep < totalSteps) {
            setCurrentStep(currentStep + 1);
            // Прокрутка к началу формы
            setTimeout(() => {
                const formElement = document.querySelector('.kyc-verification-form');
                if (formElement) {
                    formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 100);
        }
    };

    const handlePrevStep = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
            // Прокрутка к началу формы
            setTimeout(() => {
                const formElement = document.querySelector('.kyc-verification-form');
                if (formElement) {
                    formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 100);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setFieldErrors({});
        
        const firstInvalidStep = validateForm();
        if (firstInvalidStep !== null) {
            setCurrentStep(firstInvalidStep);
            return;
        }
        
        setIsSubmitting(true);

        try {
            // Создаем FormData для отправки файлов
            const formDataToSend = new FormData();
            // Объединяем имя и фамилию в full_name для бэкенда
            const fullName = `${formData.first_name.trim()} ${formData.last_name.trim()}`.trim();
            formDataToSend.append('full_name', fullName);
            formDataToSend.append('birth_date', formData.birth_date);
            formDataToSend.append('street_address', formData.street_address.trim());
            formDataToSend.append('city', formData.city.trim());
            formDataToSend.append('postal_code', formData.postal_code.trim());
            
            // Получаем название страны из списка стран (бэкенд ожидает название, а не код)
            const selectedCountryObj = countries.find(c => c.code === formData.country);
            const countryName = selectedCountryObj?.name || formData.country;
            formDataToSend.append('country', countryName);
            
            // Отправляем тип документа (теперь поддерживается residence_permit на бэкенде)
            formDataToSend.append('id_document_type', formData.id_document_type);
            formDataToSend.append('id_document_number', formData.id_document_number.trim());

            // Добавляем фотографии
            photos.forEach((photo, index) => {
                formDataToSend.append(`photos`, photo);
            });

            await userApi.submitKYC(formDataToSend);
            setSuccess(true);
            if (onSuccess) {
                onSuccess();
            }
        } catch (err: any) {
            try {
                const errorMessage = err?.message || '';
                if (errorMessage.includes('HTTP_ERROR: 400')) {
                    const errorMatch = errorMessage.match(/\{.*\}/);
                    if (errorMatch) {
                        const errorData = JSON.parse(errorMatch[0]);
                        if (errorData.errors && Array.isArray(errorData.errors)) {
                            const errors: { [key: string]: string } = {};
                            errorData.errors.forEach((errMsg: string) => {
                                const lowerMsg = errMsg.toLowerCase();
                                if (lowerMsg.includes('address') || lowerMsg.includes('адрес') || lowerMsg.includes('street')) {
                                    errors.street_address = errMsg;
                                } else if (lowerMsg.includes('postal') || lowerMsg.includes('почтовый') || lowerMsg.includes('zip') || lowerMsg.includes('индекс')) {
                                    errors.postal_code = errMsg;
                                } else if (lowerMsg.includes('birth') || lowerMsg.includes('рождени') || lowerMsg.includes('дата')) {
                                    errors.birth_date = errMsg;
                                } else if (lowerMsg.includes('city') || lowerMsg.includes('город')) {
                                    errors.city = errMsg;
                                } else if (lowerMsg.includes('document') || lowerMsg.includes('номер') || lowerMsg.includes('number')) {
                                    errors.id_document_number = errMsg;
                                }
                            });
                            if (Object.keys(errors).length > 0) {
                                setFieldErrors(errors);
                            }
                            setError(errorData.message || t('kyc.submitError'));
                        } else {
                            setError(errorData.message || errorMessage);
                        }
                    } else {
                        setError(errorMessage);
                    }
                } else {
                    setError(errorMessage || t('kyc.submitError'));
                }
            } catch {
                setError(err?.message || t('kyc.submitError'));
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (fieldErrors[field]) {
            setFieldErrors(prev => {
                const updated = { ...prev };
                delete updated[field];
                return updated;
            });
        }
    };

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
        const file = e.target.files?.[0];
        if (!file) {
            e.target.value = '';
            return;
        }

        // Проверка типа файла
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            setFieldErrors(prev => ({ ...prev, photos: t('kyc.photoInvalidType', { defaultValue: 'Допустимы только JPG, PNG или WEBP' }) }));
            e.target.value = '';
            return;
        }

        // Проверка размера файла (макс 10 МБ)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            setFieldErrors(prev => ({ ...prev, photos: t('kyc.photoTooLarge', { defaultValue: 'Размер файла не должен превышать 10 МБ' }) }));
            e.target.value = '';
            return;
        }

        // Если уже есть фото на этом индексе, заменяем его, иначе добавляем в конец
        const newPhotos = [...photos];
        const newPreviews = [...photoPreview];

        // Находим первый свободный слот или используем указанный индекс
        let targetIndex = index;
        if (index >= photos.length) {
            targetIndex = photos.length;
        }

        newPhotos[targetIndex] = file;
        
        const reader = new FileReader();
        reader.onloadend = () => {
            newPreviews[targetIndex] = reader.result as string;
            setPhotoPreview([...newPreviews]);
        };
        reader.readAsDataURL(file);

        setPhotos(newPhotos);
        if (fieldErrors.photos) {
            setFieldErrors(prev => {
                const updated = { ...prev };
                delete updated.photos;
                return updated;
            });
        }
        
        e.target.value = '';
    };

    const handlePhotoRemove = (index: number) => {
        const newPhotos = photos.filter((_, i) => i !== index);
        const newPreviews = photoPreview.filter((_, i) => i !== index);
        setPhotos(newPhotos);
        setPhotoPreview(newPreviews);
    };

    // Если уже верифицирован
    if (user?.kyc_verified) {
        return (
            <div className="kyc-status-card verified">
                <div className="kyc-status-content">
                    <div className="kyc-status-icon">✓</div>
                    <div className="kyc-status-text">
                        <h3>{t('kyc.verified')}</h3>
                        <p>{t('kyc.verifiedMessage')}</p>
                        {user.kyc_verified_at && (
                            <p className="kyc-date">{t('kyc.verifiedAt')}: {new Date(user.kyc_verified_at).toLocaleDateString()}</p>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Если отправлено на проверку
    if (user?.kyc_submitted_at && !user?.kyc_verified && !forceShowForm) {
        return (
            <div className="kyc-status-card pending">
                <div className="kyc-status-content">
                    <div className="kyc-status-icon">⏳</div>
                    <div className="kyc-status-text">
                        <h3>{t('kyc.pending')}</h3>
                        <p>{t('kyc.pendingMessage')}</p>
                        <p className="kyc-date">{t('kyc.submittedAt')}: {new Date(user.kyc_submitted_at).toLocaleDateString()}</p>
                    </div>
                </div>
                {user.kyc_rejection_reason && (
                    <div className="kyc-rejection">
                        <p className="rejection-reason">{t('kyc.rejectionReason')}: {user.kyc_rejection_reason}</p>
                        <button 
                            onClick={() => {
                                setForceShowForm(true);
                                setSuccess(false);
                                setCurrentStep(1);
                                setError(null);
                                setFieldErrors({});
                            }}
                            className="retry-btn"
                        >
                            {t('kyc.retry')}
                        </button>
                    </div>
                )}
            </div>
        );
    }

    if (success) {
        return (
            <div className="kyc-status-card success">
                <div className="kyc-status-content">
                    <div className="kyc-status-icon">✓</div>
                    <div className="kyc-status-text">
                        <h3>{t('kyc.submitted')}</h3>
                        <p>{t('kyc.submittedMessage')}</p>
                    </div>
                </div>
            </div>
        );
    }

    const renderStepIndicator = () => {
        return (
            <div className="kyc-steps">
                {[1, 2, 3].map((step) => (
                    <div key={step} className={`kyc-step ${currentStep === step ? 'active' : currentStep > step ? 'completed' : ''}`}>
                        <div className="kyc-step-number">
                            {currentStep > step ? (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                            ) : (
                                step
                            )}
                        </div>
                        <div className="kyc-step-label">
                            {step === 1 && t('kyc.step1', { defaultValue: 'Личные данные' })}
                            {step === 2 && t('kyc.step2', { defaultValue: 'Документ' })}
                            {step === 3 && t('kyc.step3', { defaultValue: 'Фотографии' })}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const renderStepContent = () => {
        if (currentStep === 1) {
            return (
                <div className="kyc-step-content">
                    <div className="step-title">
                        <h3>{t('kyc.step1Title', { defaultValue: 'Личная информация' })}</h3>
                        <p>{t('kyc.step1Description', { defaultValue: 'Укажите ваши личные данные' })}</p>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label>{t('kyc.firstName', { defaultValue: 'Имя' })} *</label>
                            <input
                                type="text"
                                value={formData.first_name}
                                onChange={(e) => handleChange('first_name', e.target.value)}
                                required
                                placeholder={t('kyc.firstNamePlaceholder', { defaultValue: 'Введите имя' })}
                            />
                            {fieldErrors.first_name && (
                                <span className="field-error">{fieldErrors.first_name}</span>
                            )}
                        </div>

                        <div className="form-group">
                            <label>{t('kyc.lastName', { defaultValue: 'Фамилия' })} *</label>
                            <input
                                type="text"
                                value={formData.last_name}
                                onChange={(e) => handleChange('last_name', e.target.value)}
                                required
                                placeholder={t('kyc.lastNamePlaceholder', { defaultValue: 'Введите фамилию' })}
                            />
                            {fieldErrors.last_name && (
                                <span className="field-error">{fieldErrors.last_name}</span>
                            )}
                        </div>
                    </div>

                    <div className="form-group">
                        <label>{t('kyc.birthDate', { defaultValue: 'Дата рождения' })} *</label>
                        <input
                            type="date"
                            value={formData.birth_date}
                            onChange={(e) => handleChange('birth_date', e.target.value)}
                            required
                            max={new Date().toISOString().split('T')[0]}
                        />
                        {fieldErrors.birth_date && (
                            <span className="field-error">{fieldErrors.birth_date}</span>
                        )}
                    </div>

                    <div className="form-group">
                        <label>{t('kyc.streetAddress', { defaultValue: 'Адрес' })} *!</label>
                        <input
                            type="text"
                            value={formData.street_address}
                            onChange={(e) => handleChange('street_address', e.target.value)}
                            required
                            placeholder={t('kyc.streetAddressPlaceholder', { defaultValue: 'Ваш адрес проживания' })}
                            minLength={5}
                            maxLength={200}
                        />
                        {fieldErrors.street_address && (
                            <span className="field-error">{fieldErrors.street_address}</span>
                        )}
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>{t('kyc.city', { defaultValue: 'Город' })} *</label>
                            <input
                                type="text"
                                value={formData.city}
                                onChange={(e) => handleChange('city', e.target.value)}
                                required
                                placeholder={t('kyc.cityPlaceholder', { defaultValue: 'Название города' })}
                                maxLength={100}
                            />
                            {fieldErrors.city && (
                                <span className="field-error">{fieldErrors.city}</span>
                            )}
                        </div>

                        <div className="form-group">
                            <label>{t('kyc.postalCode', { defaultValue: 'Почтовый индекс' })} *</label>
                            <input
                                type="text"
                                value={formData.postal_code}
                                onChange={(e) => handleChange('postal_code', e.target.value)}
                                required
                                placeholder={t('kyc.postalCodePlaceholder', { defaultValue: 'Почтовый индекс' })}
                                minLength={4}
                                maxLength={20}
                            />
                            {fieldErrors.postal_code && (
                                <span className="field-error">{fieldErrors.postal_code}</span>
                            )}
                        </div>
                    </div>

                    <div className="form-group">
                        <label>{t('kyc.country')} *</label>
                        <CountrySelect
                            value={formData.country}
                            onChange={(value) => handleChange('country', value)}
                            options={countries}
                            placeholder={t('kyc.countryPlaceholder', { defaultValue: 'Выберите страну' })}
                            loading={loadingCountries}
                        />
                        {fieldErrors.country && (
                            <span className="field-error">{fieldErrors.country}</span>
                        )}
                    </div>
                </div>
            );
        }

        if (currentStep === 2) {
            return (
                <div className="kyc-step-content">
                    <div className="step-title">
                        <h3>{t('kyc.step2Title', { defaultValue: 'Документ удостоверения личности' })}</h3>
                        <p>{t('kyc.step2Description', { defaultValue: 'Укажите данные документа' })}</p>
                    </div>
                    <div className="form-group">
                        <label>{t('kyc.idDocumentType')} *</label>
                        <select
                            value={formData.id_document_type}
                            onChange={(e) => handleChange('id_document_type', e.target.value)}
                            required
                        >
                            <option value="national_id">{t('kyc.nationalIdCard', { defaultValue: 'ID-карта' })}</option>
                            <option value="passport">{t('kyc.passport', { defaultValue: 'Паспорт' })}</option>
                            <option value="residence_permit">{t('kyc.residencePermit', { defaultValue: 'Вид на жительство' })}</option>
                            <option value="drivers_license">{t('kyc.driversLicense', { defaultValue: 'Водительские права' })}</option>
                        </select>
                        {fieldErrors.id_document_type && (
                            <span className="field-error">{fieldErrors.id_document_type}</span>
                        )}
                    </div>

                    <div className="form-group">
                        <label>{t('kyc.idDocumentNumber')} *</label>
                        <input
                            type="text"
                            value={formData.id_document_number}
                            onChange={(e) => handleChange('id_document_number', e.target.value)}
                            required
                            minLength={5}
                            maxLength={50}
                            placeholder={t('kyc.idDocumentNumberPlaceholder')}
                        />
                        {fieldErrors.id_document_number && (
                            <span className="field-error">{fieldErrors.id_document_number}</span>
                        )}
                    </div>

                    <div className="form-note">
                        <p>{t('kyc.note')}</p>
                    </div>
                </div>
            );
        }

        if (currentStep === 3) {
            return (
                <div className="kyc-step-content">
                    <div className="step-title">
                        <h3>{t('kyc.step3Title', { defaultValue: 'Загрузка фотографий документов' })}</h3>
                        <p>{t('kyc.step3Description', { defaultValue: 'Загрузите фотографии вашего документа (до 4 фотографий)' })}</p>
                    </div>

                    {fieldErrors.photos && (
                        <div className="kyc-error" style={{ marginBottom: '20px' }}>
                            {fieldErrors.photos}
                        </div>
                    )}

                    <div className="kyc-photos-upload">
                        {[0, 1, 2, 3].map((index) => {
                            const hasPhoto = index < photos.length && photoPreview[index];
                            return (
                                <div key={index} className="kyc-photo-upload-item">
                                    {hasPhoto ? (
                                        <div className="kyc-photo-preview">
                                            <img src={photoPreview[index]} alt={`Preview ${index + 1}`} />
                                            <button
                                                type="button"
                                                className="kyc-photo-remove"
                                                onClick={() => handlePhotoRemove(index)}
                                                aria-label={t('kyc.removePhoto', { defaultValue: 'Удалить фото' })}
                                            >
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                                </svg>
                                            </button>
                                            <button
                                                type="button"
                                                className="kyc-photo-replace"
                                                onClick={() => document.getElementById(`kyc-photo-input-${index}`)?.click()}
                                            >
                                                {t('kyc.replacePhoto', { defaultValue: 'Заменить' })}
                                            </button>
                                        </div>
                                    ) : (
                                        <label className="kyc-photo-upload-label" htmlFor={`kyc-photo-input-${index}`}>
                                            <div className="kyc-photo-upload-icon">
                                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                    <polyline points="17 8 12 3 7 8"></polyline>
                                                    <line x1="12" y1="3" x2="12" y2="15"></line>
                                                </svg>
                                            </div>
                                            <span className="kyc-photo-upload-text">
                                                {t('kyc.uploadPhoto', { defaultValue: 'Загрузить фото' })}
                                            </span>
                                            <span className="kyc-photo-upload-hint">
                                                {t('kyc.photoHint', { defaultValue: 'JPG, PNG, WEBP до 10 МБ' })}
                                            </span>
                                        </label>
                                    )}
                                    <input
                                        id={`kyc-photo-input-${index}`}
                                        type="file"
                                        accept="image/jpeg,image/jpg,image/png,image/webp"
                                        onChange={(e) => handlePhotoUpload(e, index)}
                                        style={{ display: 'none' }}
                                    />
                                </div>
                            );
                        })}
                    </div>

                    <div className="form-note">
                        <p>{t('kyc.photosNote', { defaultValue: 'Рекомендуется загрузить: лицевую сторону документа, обратную сторону (если требуется), фото с документом' })}</p>
                    </div>
                </div>
            );
        }

        return null;
    };

    return (
        <div className="kyc-verification-form">
            {renderStepIndicator()}

            {error && (
                <div className="kyc-error">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="kyc-form">
                {renderStepContent()}

                <div className="kyc-form-actions">
                    {currentStep > 1 && (
                        <button
                            type="button"
                            className="kyc-btn kyc-btn-secondary"
                            onClick={handlePrevStep}
                            disabled={isSubmitting}
                        >
                            {t('kyc.back', { defaultValue: 'Назад' })}
                        </button>
                    )}
                    <div className="kyc-form-actions-spacer"></div>
                    {currentStep < totalSteps ? (
                        <button
                            type="button"
                            className="kyc-btn kyc-btn-primary"
                            onClick={handleNextStep}
                        >
                            {t('kyc.next', { defaultValue: 'Далее' })}
                        </button>
                    ) : (
                        <button 
                            type="submit" 
                            className="kyc-btn kyc-btn-primary submit-btn" 
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? t('common.submitting') : t('kyc.submit')}
                        </button>
                    )}
                </div>
            </form>
        </div>
    );
}

