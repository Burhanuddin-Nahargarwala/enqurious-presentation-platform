import React from 'react';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs/components/prism-core';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-markup'; // HTML
import 'prismjs/themes/prism.css'; // Default theme

const SlideEditor = ({ code, onChange, readOnly = false }) => {
    return (
        <div className="border border-secondary-200 rounded-lg overflow-hidden bg-white font-mono text-sm">
            <Editor
                value={code}
                onValueChange={onChange}
                highlight={code => highlight(code, languages.markup)}
                padding={16}
                readOnly={readOnly}
                style={{
                    fontFamily: '"Fira code", "Fira Mono", monospace',
                    fontSize: 14,
                    minHeight: '400px',
                }}
                className="min-h-[400px]"
            />
        </div>
    );
};

export default SlideEditor;
