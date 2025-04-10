import {
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import { Command as CommandPrimitive } from "cmdk"
import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type KeyboardEvent,
} from "react"

import { Skeleton } from "@/components/ui/skeleton"

import { cn } from "@/lib/utils"
import { Check } from "lucide-react"

export type Option = Record<"value" | "label", string> & Record<string, string>

type ComboboxInputProps = {
  options: Option[]
  emptyMessage: string
  value?: Option
  onValueChange?: (value: Option) => void
  isLoading?: boolean
  disabled?: boolean
  placeholder?: string
}

export const ComboboxInput = ({
  options,
  placeholder,
  emptyMessage,
  value,
  onValueChange,
  disabled,
  isLoading = false,
}: ComboboxInputProps) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<"top" | "bottom">("bottom")

  const [isOpen, setOpen] = useState(false)
  const [selected, setSelected] = useState<Option>(value as Option)
  const [inputValue, setInputValue] = useState<string>(value?.label || "")

  // Update selected and inputValue when value prop changes
  useEffect(() => {
    if (value) {
      setSelected(value)
      setInputValue(value.label)
    }
  }, [value])

  useEffect(() => {
    if (isOpen && containerRef.current && inputRef.current) {
      const container = containerRef.current
      const input = inputRef.current
      const rect = container.getBoundingClientRect()
      const inputHeight = input.offsetHeight
      const spaceBelow = window.innerHeight - (rect.bottom + inputHeight)
      const spaceAbove = rect.top - inputHeight
      const dropdownHeight = 200 // max-h-[200px] from the CommandGroup

      setPosition(
        spaceBelow >= dropdownHeight || spaceBelow >= spaceAbove
          ? "bottom"
          : "top"
      )
    }
  }, [isOpen])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const input = inputRef.current
      if (!input) {
        return
      }

      // Keep the options displayed when the user is typing
      if (!isOpen) {
        setOpen(true)
      }

      // This is not a default behaviour of the <input /> field
      if (event.key === "Enter" && input.value !== "") {
        const optionToSelect = options.find(
          option => option.label === input.value
        )
        if (optionToSelect) {
          setSelected(optionToSelect)
          onValueChange?.(optionToSelect)
        }
      }

      if (event.key === "Escape") {
        input.blur()
      }
    },
    [isOpen, options, onValueChange]
  )

  const handleBlur = useCallback(() => {
    setOpen(false)
    setInputValue(selected?.label)
  }, [selected])

  const handleSelectOption = useCallback(
    (selectedOption: Option) => {
      setInputValue(selectedOption.label)

      setSelected(selectedOption)
      onValueChange?.(selectedOption)

      // This is a hack to prevent the input from being focused after the user selects an option
      // We can call this hack: "The next tick"
      setTimeout(() => {
        inputRef?.current?.blur()
      }, 0)
    },
    [onValueChange]
  )

  return (
    <CommandPrimitive onKeyDown={handleKeyDown}>
      <div ref={containerRef} className="relative">
        <CommandInput
          ref={inputRef}
          value={inputValue}
          onValueChange={isLoading ? undefined : setInputValue}
          onBlur={handleBlur}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="text-base"
        />
        <div
          className={cn(
            "animate-in fade-in-0 zoom-in-95 absolute z-10 w-full rounded-xl bg-white outline-none",
            position === "bottom" ? "top-full mt-1" : "bottom-full mb-1",
            isOpen ? "block" : "hidden"
          )}
        >
          <CommandList className="rounded-lg ring-1 ring-slate-200">
            {isLoading ? (
              <CommandPrimitive.Loading>
                <div className="p-1">
                  <Skeleton className="h-8 w-full" />
                </div>
              </CommandPrimitive.Loading>
            ) : null}
            {options.length > 0 && !isLoading ? (
              <CommandGroup className="max-h-[200px] overflow-y-auto">
                {options
                  .filter(
                    option =>
                      !inputValue ||
                      option.label
                        .toLowerCase()
                        .includes(inputValue?.toLowerCase() || "")
                  )
                  .slice(0, 5)
                  .map(option => {
                    const isSelected = selected?.value === option.value
                    return (
                      <CommandItem
                        key={option.value}
                        value={option.label}
                        onMouseDown={event => {
                          event.preventDefault()
                          event.stopPropagation()
                        }}
                        onSelect={() => handleSelectOption(option)}
                        className={cn(
                          "flex w-full items-center gap-2",
                          !isSelected ? "pl-8" : null
                        )}
                      >
                        {isSelected ? <Check className="w-4" /> : null}
                        {option.label}
                      </CommandItem>
                    )
                  })}
              </CommandGroup>
            ) : null}
            {!isLoading ? (
              <CommandPrimitive.Empty className="select-none rounded-sm px-2 py-3 text-center text-sm">
                {emptyMessage}
              </CommandPrimitive.Empty>
            ) : null}
          </CommandList>
        </div>
      </div>
    </CommandPrimitive>
  )
}
