#import <Foundation/Foundation.h>
#import <Vision/Vision.h>
#import <ImageIO/ImageIO.h>

// Read a single image from stdin. Vision's observations can contain separate
// columns for an item and its price, so join boxes that share a baseline.
int main(void) {
    @autoreleasepool {
        NSData *bytes = NSFileHandle.fileHandleWithStandardInput.readDataToEndOfFile;
        CGImageSourceRef source = CGImageSourceCreateWithData((__bridge CFDataRef)bytes, NULL);
        if (!source) return 1;
        NSDictionary *options = @{
            (__bridge NSString *)kCGImageSourceCreateThumbnailFromImageAlways: @YES,
            (__bridge NSString *)kCGImageSourceCreateThumbnailWithTransform: @YES,
            (__bridge NSString *)kCGImageSourceThumbnailMaxPixelSize: @3600
        };
        CGImageRef image = CGImageSourceCreateThumbnailAtIndex(source, 0, (__bridge CFDictionaryRef)options);
        CFRelease(source);
        if (!image) return 1;
        VNRecognizeTextRequest *request = [[VNRecognizeTextRequest alloc] init];
        request.recognitionLevel = VNRequestTextRecognitionLevelAccurate;
        request.usesLanguageCorrection = NO;
        VNImageRequestHandler *handler = [[VNImageRequestHandler alloc] initWithCGImage:image options:@{}];
        BOOL ok = [handler performRequests:@[request] error:nil];
        CGImageRelease(image);
        if (!ok) return 1;
        NSArray *ordered = [request.results sortedArrayUsingComparator:^NSComparisonResult(VNRecognizedTextObservation *a, VNRecognizedTextObservation *b) {
            return [@(CGRectGetMidY(b.boundingBox)) compare:@(CGRectGetMidY(a.boundingBox))];
        }];
        NSMutableArray<NSMutableArray *> *lines = [NSMutableArray array];
        CGRect anchor = CGRectZero;
        for (VNRecognizedTextObservation *box in ordered) {
            CGRect bounds = box.boundingBox;
            if (!lines.count || fabs(CGRectGetMidY(bounds) - CGRectGetMidY(anchor)) > MIN(bounds.size.height, anchor.size.height) * 0.55) {
                [lines addObject:[NSMutableArray array]];
                anchor = bounds;
            }
            [lines.lastObject addObject:box];
        }
        for (NSMutableArray *line in lines) {
            [line sortUsingComparator:^NSComparisonResult(VNRecognizedTextObservation *a, VNRecognizedTextObservation *b) {
                return [@(CGRectGetMinX(a.boundingBox)) compare:@(CGRectGetMinX(b.boundingBox))];
            }];
            NSMutableArray *words = [NSMutableArray array];
            for (VNRecognizedTextObservation *box in line) {
                NSString *text = [box topCandidates:1].firstObject.string;
                if (text) [words addObject:text];
            }
            puts([words componentsJoinedByString:@" "].UTF8String);
        }
    }
    return 0;
}
