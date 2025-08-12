/* eslint-disable @typescript-eslint/no-explicit-any */
import { ContentLoader } from './loader';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

/**
 * Enhanced content loader that supports content references and abstraction
 */
export class EnhancedContentLoader extends ContentLoader {
  private sharedCache: Record<string, any> = {};
  private templateCache: Record<string, any> = {};

  /**
   * Static method to load page content
   * @param pageName Name of the page
   * @param language Language code
   * @returns Page content
   */
  public static async loadPageContent(pageName: string, language: string = 'en'): Promise<any> {
    const loader = new EnhancedContentLoader();
    const contentPath = `pages/${pageName}`;
    return loader.loadContent(contentPath, { language });
  }

  /**
   * Static method to load component content
   * @param componentName Name of the component
   * @returns Component content
   */
  public static async loadComponentContent<T>(componentName: string): Promise<T> {
    const loader = new EnhancedContentLoader();
    const contentPath = `components/${componentName}`;
    return loader.loadContent(contentPath) as Promise<T>;
  }

  /**
   * Static method to get available pages
   * @returns List of available page names
   */
  public static async getAvailablePages(): Promise<string[]> {
    const loader = new EnhancedContentLoader();
    return loader.getAvailablePages();
  }

  /**
   * Load content with support for references
   * @param contentPath Path to the content file
   * @param options Loading options
   * @returns Processed content with resolved references
   */
  public async loadContent(contentPath: string, options = { language: 'en' }): Promise<any> {
    // Load the raw content
    const rawContent = await super.loadContent(contentPath, options);
    
    // Process content references
    return this.processContentReferences(rawContent, contentPath);
  }

  /**
   * Process all content references in the content object
   * @param content Content object with references
   * @param sourcePath Original content path for resolving relative paths
   * @returns Processed content with resolved references
   */
  private async processContentReferences(content: any, sourcePath: string): Promise<any> {
    // If there are no references, return the content as is
    if (!content.$use) {
      return content;
    }

    // Clone the content to avoid modifying the original
    const processedContent = { ...content };
    
    // Process template reference if present
    if (content.$use.template) {
      processedContent.$template = await this.loadTemplate(content.$use.template);
    }

    // Process navigation reference
    if (content.$use.navigation) {
      processedContent.navigation = await this.loadSharedContent('navigation.yml');
    }

    // Process footer reference
    if (content.$use.footer) {
      processedContent.footer = await this.loadSharedContent('footer.yml');
    }

    // Process common content references
    if (content.$use.common) {
      const commonContent = await this.loadSharedContent('common.yml');
      
      // Process each requested section from common content
      for (const [key, value] of Object.entries(content.$use.common)) {
        if (value && commonContent[key]) {
          processedContent[key] = commonContent[key];
        }
      }
    }

    // Process section extensions
    for (const [key, value] of Object.entries(processedContent)) {
      if (typeof value === 'object' && value !== null && value.$extend) {
        processedContent[key] = await this.extendSection(value, key, processedContent);
      }
      
      // Process section references
      if (typeof value === 'object' && value !== null && value.$use) {
        processedContent[key] = await this.resolveReference(value.$use, processedContent);
      }
    }

    // Remove the $use directive from the processed content
    delete processedContent.$use;
    
    return processedContent;
  }

  /**
   * Load a shared content file
   * @param fileName Name of the shared content file
   * @param language Language code
   * @returns Shared content
   */
  private async loadSharedContent(fileName: string, language = 'en'): Promise<any> {
    const cacheKey = `${fileName}:${language}`;
    
    // Return from cache if available
    if (this.sharedCache[cacheKey]) {
      return this.sharedCache[cacheKey];
    }
    
    // Determine the file path
    const filePath = path.join(process.cwd(), 'content', 'shared', fileName);
    
    // Load and parse the content
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const parsedContent = yaml.load(content) as Record<string, any>;
    
    // Cache the content
    this.sharedCache[cacheKey] = parsedContent;
    
    return parsedContent;
  }

  /**
   * Load a template file
   * @param templatePath Path to the template file
   * @returns Template content
   */
  private async loadTemplate(templatePath: string): Promise<any> {
    // Return from cache if available
    if (this.templateCache[templatePath]) {
      return this.templateCache[templatePath];
    }
    
    // Determine the file path
    const filePath = path.join(process.cwd(), 'content', templatePath);
    
    // Load and parse the content
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const parsedContent = yaml.load(content) as Record<string, any>;
    
    // Cache the content
    this.templateCache[templatePath] = parsedContent;
    
    return parsedContent;
  }

  /**
   * Resolve a reference to another content section
   * @param reference Reference path
   * @param content Parent content object
   * @returns Resolved content
   */
  private async resolveReference(reference: string, content: any): Promise<any> {
    // Parse the reference path
    const parts = reference.split('.');
    
    // Start with the root content object
    let result = content;
    
    // Special case for template references
    if (parts[0] === 'template' && content.$template) {
      result = content.$template;
      parts.shift(); // Remove the 'template' part
    }
    
    // Follow the path to the referenced content
    for (const part of parts) {
      if (result[part] !== undefined) {
        result = result[part];
      } else {
        console.warn(`Reference not found: ${reference}`);
        return null;
      }
    }
    
    return result;
  }

  /**
   * Extend a section with base content
   * @param section Section with $extend directive
   * @param key Section key
   * @param content Parent content object
   * @returns Extended section
   */
  private async extendSection(section: any, key: string, content: any): Promise<any> {
    // Clone the section to avoid modifying the original
    const extendedSection = { ...section };
    
    // Determine the base section
    let baseSection: any = null;
    
    if (typeof section.$extend === 'string') {
      // Extend from a specific reference
      baseSection = await this.resolveReference(section.$extend, content);
    } else if (content.$template && content.$template[key]) {
      // Extend from template
      baseSection = content.$template[key];
    }
    
    // If no base section was found, return the original
    if (!baseSection) {
      delete extendedSection.$extend;
      return extendedSection;
    }
    
    // Merge the base section with the extended section
    const merged = {
      ...baseSection,
      ...extendedSection
    };
    
    // Remove the $extend directive
    delete merged.$extend;
    
    return merged;
  }
}