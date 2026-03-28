import { useState } from "react"
import { Trash2, ImageIcon } from "lucide-react"
import { toast } from "react-toastify"
import { resolveImageUrl } from "../../../utils/resolve"
import { processImageFile, SUPPORTED_IMAGE_TYPES } from "../../../utils/imageProcessing"
import ToggleSwitch from "../../../components/Toggle/ToggleSwitch"
import { Input } from "../../../components/Input/Input"
import { ImageUpload } from "../../../components/Upload/ImageUpload"

export interface LocalOption {
  id: string;
  name: string;
  values: string[];
  is_image_key: boolean;
  value_images: Record<string, { file?: File; url?: string; valueId?: number }>;
}

export function OptionCard({ 
  option, 
  index, 
  updateOption, 
  removeOption,
  onDeleteValueImage
}: { 
  option: LocalOption; 
  index: number; 
  updateOption: (idx: number, opt: LocalOption) => void; 
  removeOption: (idx: number) => void;
  productId?: number;
  onDeleteValueImage?: (keyId: number, valueId: number) => void;
}) {
  const [inputValue, setInputValue] = useState("")

  const handleAddValue = () => {
    const val = inputValue.trim()
    if (val && !option.values.includes(val)) {
      updateOption(index, { ...option, values: [...option.values, val] })
      setInputValue("")
    }
  }

  return (
    <div className="border border-gray-200 rounded-xl p-6 bg-white mb-6 relative shadow-sm">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-bold text-gray-700">Product Option {index + 1}</label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">Use Image</span>
            <ToggleSwitch 
              checked={option.is_image_key} 
              onChange={() => updateOption(index, { ...option, is_image_key: !option.is_image_key })} 
            />
          </div>
        </div>
        <Input
          value={option.name}
          onChange={(e) => updateOption(index, { ...option, name: e.target.value })}
          placeholder="e.g. Color, Size"
        />
      </div>
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">Option Values</label>
        {option.values.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {option.values.map((val, vIdx) => (
              <div key={vIdx} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-orange-200 text-[#ff5a36] bg-orange-50 text-sm font-medium">
                <span>{val}</span>
                <button 
                  onClick={() => {
                    const newValues = option.values.filter((_, i) => i !== vIdx)
                    const newValueImages = { ...option.value_images }
                    delete newValueImages[val]
                    updateOption(index, { ...option, values: newValues, value_images: newValueImages })
                  }} 
                  className="hover:text-red-500 flex items-center justify-center cursor-pointer"
                >
                  <span className="text-lg leading-none">&times;</span>
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-4">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddValue(); } }}
            placeholder="e.g. the value red."
            className="w-full"
            containerClassName="flex-1"
          />
          <button onClick={handleAddValue} className="px-6 py-3 bg-[#ff5a36] text-white rounded-lg font-bold hover:bg-[#e04e2d] transition-all whitespace-nowrap cursor-pointer">
            + Add
          </button>
        </div>

        {option.is_image_key && option.values.length > 0 && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {option.values.map((val, vIdx) => (
              <div key={vIdx} className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg bg-gray-50">
                <div className="w-12 h-12 rounded bg-white border border-gray-200 flex-shrink-0 flex items-center justify-center overflow-hidden">
                  {option.value_images[val]?.url ? (
                    <img src={resolveImageUrl(option.value_images[val].url)} alt={val} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-gray-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-700 truncate">{val}</p>
                  <p className="text-xs text-gray-400">
                    {option.value_images[val]?.file ? "File ready" : option.value_images[val]?.url ? "Uploaded" : "No image"}
                  </p>
                </div>
                <div className="flex-1">
                  <ImageUpload 
                    multiple={false}
                    accept={SUPPORTED_IMAGE_TYPES}
                    onFilesChange={async (files) => {
                      const file = files[0];
                      if (file) {
                        try {
                          const processedFile = await processImageFile(file);
                          const previewUrl = URL.createObjectURL(processedFile);
                          const newImages = { ...option.value_images };
                          newImages[val] = { file: processedFile, url: previewUrl };
                          updateOption(index, { ...option, value_images: newImages });
                        } catch (err) {
                          toast.error("Failed to process image")
                        }
                      }
                    }}
                    hint={option.value_images[val]?.file ? "File ready" : option.value_images[val]?.url ? "Uploaded" : undefined}
                  />
                </div>
                {(option.value_images[val]?.file || option.value_images[val]?.url) && (
                  <button 
                    onClick={() => {
                      const imgData = option.value_images[val];
                      if (imgData?.valueId && onDeleteValueImage) {
                        onDeleteValueImage(Number(option.id ), imgData.valueId);
                      }
                      const newImages = { ...option.value_images };
                      newImages[val] = { ...newImages[val], file: undefined, url: undefined };
                      updateOption(index, { ...option, value_images: newImages });
                    }}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                    title="Remove Image"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <button onClick={() => removeOption(index)} className="px-6 py-2.5 border border-red-200 bg-white rounded-lg font-bold text-red-500 hover:bg-red-50 transition-all cursor-pointer">Delete</button>
      </div>
    </div>
  )
}
